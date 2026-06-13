#!/usr/bin/env python3
"""
人脸检索 API 服务 - 基于 FastAPI
启动命令：python scripts/face_api.py
或使用 pnpm: pnpm face:serve

服务启动后，模型只初始化一次，后续请求直接处理，响应更快。
"""

import os
import sys
import pickle
from pathlib import Path
import numpy as np
from scipy.spatial.distance import cdist
import cv2
import logging

import insightface
from insightface.app import FaceAnalysis
import onnxruntime as ort
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# 加载环境变量
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ========== 配置 ==========
BASE_DIR = Path(__file__).parent.parent.resolve()
PHOTOS_DIR = BASE_DIR / "public" / "photos"          # 相册照片目录
STUDENT_DIR = BASE_DIR / "public" / "students"       # 学生大头照目录
INDEX_DIR = BASE_DIR / "face_indexes"                # 索引缓存目录

# InsightFace 参数
SIMILARITY_THRESHOLD = 0.5
SUPPORTED_FORMATS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}

# API 配置（从环境变量读取，默认值作为备选）
API_HOST = os.getenv("FACE_API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("FACE_API_PORT", 8001))
API_USE_GPU = os.getenv("FACE_API_USE_GPU", "false").lower() == "true"
API_THREADS = int(os.getenv("FACE_API_THREADS", 8))

# 全局变量
app = None
student_index = None
album_indexes = {}  # 缓存已加载的相册索引

# FastAPI 应用
api_app = FastAPI(title="人脸检索 API", description="基于 InsightFace 的人脸检索服务")


class SearchRequest(BaseModel):
    album: str
    query: str


class SearchResponse(BaseModel):
    photos: list[str]


def init_face_analysis(use_gpu: bool = False, num_threads: int = 8):
    """初始化 InsightFace 应用（只执行一次）"""
    global app
    if app is not None:
        logger.info("InsightFace 已初始化，跳过")
        return

    if use_gpu:
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        ctx_id = 0
        logger.info("使用 GPU (CUDA) 加速")
    else:
        sess_options = ort.SessionOptions()
        sess_options.intra_op_num_threads = num_threads
        sess_options.inter_op_num_threads = num_threads
        providers = [
            ('CPUExecutionProvider', {
                'session_options': sess_options
            })
        ]
        ctx_id = -1
        logger.info(f"使用 CPU 推理，线程数: {num_threads}")

    app = FaceAnalysis(name='buffalo_l', providers=providers)
    app.prepare(ctx_id=ctx_id, det_size=(640, 640))
    logger.info("InsightFace 初始化完成")


def load_student_index():
    """加载学生库索引（只加载一次）"""
    global student_index
    if student_index is not None:
        logger.info("学生库索引已加载，跳过")
        return

    index_file = INDEX_DIR / "students.pkl"
    if not index_file.exists():
        raise RuntimeError(f"学生库索引文件不存在: {index_file}")
    
    with open(index_file, 'rb') as f:
        student_index = pickle.load(f)
    logger.info(f"学生库索引加载完成，共 {len(student_index)} 个学生")


def load_album_index(album_name: str):
    """加载相册索引（缓存机制）"""
    if album_name in album_indexes:
        return album_indexes[album_name]

    index_file = INDEX_DIR / f"{album_name}.pkl"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail=f"相册索引不存在: {album_name}")
    
    with open(index_file, 'rb') as f:
        album_index = pickle.load(f)
    
    album_indexes[album_name] = album_index
    logger.info(f"相册 '{album_name}' 索引加载完成，共 {len(album_index)} 个人脸向量")
    return album_index


def extract_embeddings_from_image(img_path):
    """提取图片中所有人脸的 embedding"""
    if app is None:
        raise RuntimeError("InsightFace 未初始化")
    
    img = cv2.imread(str(img_path))
    if img is None:
        return []
    
    faces = app.get(img)
    result = []
    for face in faces:
        emb = face.embedding.astype(np.float32)
        det_score = face.det_score if hasattr(face, 'det_score') else 0.0
        result.append((emb, det_score))
    return result


@api_app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """搜索相册中包含指定学生的照片"""
    album_name = request.album
    query = request.query

    if not query.strip():
        raise HTTPException(status_code=400, detail="搜索关键词不能为空")

    try:
        # 确保学生库索引已加载
        load_student_index()
        
        # 加载相册索引
        album_index = load_album_index(album_name)

        # 查找匹配的学生
        matched_students = []
        for student in student_index:
            if query == student["student_id"] or query in student["student_name"]:
                matched_students.append(student)
        
        if not matched_students:
            return {"photos": []}

        # 执行人脸匹配
        all_matched_photos = set()
        
        for student in matched_students:
            stu_emb = student['embedding']
            all_embs = np.vstack([item['embedding'] for item in album_index])
            distances = cdist(stu_emb.reshape(1, -1), all_embs, metric='cosine').flatten()
            mask = distances < SIMILARITY_THRESHOLD
            matched_indices = np.where(mask)[0]
            
            for idx in matched_indices:
                photo_rel = album_index[idx]["photo"]
                photo_name = Path(photo_rel).name
                all_matched_photos.add(photo_name)

        return {"photos": list(all_matched_photos)}

    except Exception as e:
        logger.error(f"搜索失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_app.get("/health")
async def health_check():
    """健康检查接口"""
    return {"status": "healthy", "models_loaded": app is not None}


@api_app.get("/albums")
async def list_albums():
    """获取可用的相册列表"""
    if not INDEX_DIR.exists():
        return {"albums": []}
    
    album_files = [f for f in INDEX_DIR.glob("*.pkl") if f.stem != "students"]
    return {"albums": [f.stem for f in album_files]}


@api_app.get("/students")
async def list_students():
    """获取学生列表"""
    try:
        load_student_index()
        students = [
            {"student_id": s["student_id"], "student_name": s["student_name"]}
            for s in student_index
        ]
        return {"students": students}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def main():
    import argparse
    parser = argparse.ArgumentParser(description="人脸检索 API 服务")
    parser.add_argument('--gpu', action='store_true', default=API_USE_GPU, help='使用 GPU（默认从环境变量 FACE_API_USE_GPU 读取）')
    parser.add_argument('--threads', type=int, default=API_THREADS, help='CPU 线程数（默认从环境变量 FACE_API_THREADS 读取）')
    parser.add_argument('--host', type=str, default=API_HOST, help='服务地址（默认从环境变量 FACE_API_HOST 读取）')
    parser.add_argument('--port', type=int, default=API_PORT, help='服务端口（默认从环境变量 FACE_API_PORT 读取）')
    args = parser.parse_args()

    logger.info("启动人脸检索 API 服务...")
    
    # 初始化 InsightFace（只执行一次）
    init_face_analysis(use_gpu=args.gpu, num_threads=args.threads)
    
    # 预加载学生库索引
    try:
        load_student_index()
    except Exception as e:
        logger.warning(f"学生库索引未加载: {e}")

    logger.info(f"API 服务启动，监听: http://{args.host}:{args.port}")
    logger.info(f"文档地址: http://{args.host}:{args.port}/docs")

    # 启动 FastAPI 服务
    import uvicorn
    uvicorn.run(api_app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()