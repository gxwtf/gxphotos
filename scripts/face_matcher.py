#!/usr/bin/env python3
"""
游学照片人脸检索工具 v3 - InsightFace 版本（支持 GPU / 自定义 CPU 线程数）
用法：
  1. 构建相册索引： python scripts/face_matcher.py build <相册名称>
                    python scripts/face_matcher.py build <相册名称> --gpu
                    python scripts/face_matcher.py build <相册名称> --threads 4
  2. 构建学生库索引： python scripts/face_matcher.py build students
  3. 查询：           python scripts/face_matcher.py search <相册名称> <学号/姓名>
                    python scripts/face_matcher.py search <相册名称> <学号/姓名> --gpu
  4. 查看帮助：       python scripts/face_matcher.py --help
"""

import os
import sys
import pickle
import shutil
import argparse
from pathlib import Path
import numpy as np
from scipy.spatial.distance import cdist
import cv2
import logging
from tqdm import tqdm

import insightface
from insightface.app import FaceAnalysis
import onnxruntime as ort

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stderr)
logger = logging.getLogger(__name__)

# ========== 配置 ==========
BASE_DIR = Path(__file__).parent.parent.resolve()
PHOTOS_DIR = BASE_DIR / "public" / "photos"          # 相册照片目录
STUDENT_DIR = BASE_DIR / "public" / "students"       # 学生大头照目录
OUTPUT_DIR = BASE_DIR / "public" / "search_results"  # 查询结果输出目录（必须在 public 下）
INDEX_DIR = BASE_DIR / "face_indexes"                # 索引缓存目录

# InsightFace 参数
SIMILARITY_THRESHOLD = 0.5
SUPPORTED_FORMATS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
# ==========================

# 全局应用实例
app = None


def init_face_analysis(use_gpu: bool, num_threads: int = 8):
    global app
    
    import logging as python_logging
    original_level = python_logging.getLogger('insightface').level
    python_logging.getLogger('insightface').setLevel(python_logging.WARNING)
    
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
    
    python_logging.getLogger('insightface').setLevel(original_level)


def extract_embeddings_from_image(img_path):
    if app is None:
        raise RuntimeError("InsightFace 未初始化，请先运行程序")
    img = cv2.imread(str(img_path))
    if img is None:
        return []
    faces = app.get(img)
    result = []
    for face in faces:
        emb = face.embedding.astype(np.float32)
        area = {
            'x': int(face.bbox[0]),
            'y': int(face.bbox[1]),
            'w': int(face.bbox[2] - face.bbox[0]),
            'h': int(face.bbox[3] - face.bbox[1])
        }
        det_score = face.det_score if hasattr(face, 'det_score') else 0.0
        result.append((emb, area, det_score))
    return result


def build_album_index(album_name: str):
    album_dir = PHOTOS_DIR / album_name
    if not album_dir.exists():
        logger.error(f"相册目录不存在: {album_dir}")
        sys.exit(1)

    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    index_file = INDEX_DIR / f"{album_name}.pkl"

    logger.info(f"开始构建相册 '{album_name}' 的人脸索引...")
    image_files = [f for f in album_dir.rglob("*") if f.suffix.lower() in SUPPORTED_FORMATS]
    logger.info(f"共发现 {len(image_files)} 张图片")

    index_data = []
    total_faces = 0

    for img_path in tqdm(image_files, desc="处理图片", unit="张"):
        faces = extract_embeddings_from_image(img_path)
        for emb, area, det_score in faces:
            index_data.append({
                "photo": str(img_path.relative_to(BASE_DIR)),
                "embedding": emb,
                "facial_area": area
            })
        total_faces += len(faces)

    with open(index_file, 'wb') as f:
        pickle.dump(index_data, f)
    logger.info(f"索引构建完成！共 {len(index_data)} 个人脸向量，已保存至 {index_file}")


def build_student_index():
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    index_file = INDEX_DIR / "students.pkl"

    logger.info("开始构建学生库人脸索引...")
    image_files = [f for f in STUDENT_DIR.rglob("*") if f.suffix.lower() in SUPPORTED_FORMATS]
    logger.info(f"共发现 {len(image_files)} 张学生照片")

    index_data = []
    for img_path in tqdm(image_files, desc="处理学生照片", unit="张"):
        faces = extract_embeddings_from_image(img_path)
        if not faces:
            logger.warning(f"未能从 {img_path.name} 中检测到人脸")
            continue
        
        emb, area, det_score = max(faces, key=lambda f: f[2])
        
        filename = img_path.stem
        student_id = filename.split('_')[0] if '_' in filename else filename
        student_name = filename.split('_')[1] if '_' in filename else ""
        
        index_data.append({
            "student_id": student_id,
            "student_name": student_name,
            "photo": str(img_path.relative_to(BASE_DIR)),
            "embedding": emb
        })

    with open(index_file, 'wb') as f:
        pickle.dump(index_data, f)
    logger.info(f"学生库索引构建完成！共 {len(index_data)} 个学生，已保存至 {index_file}")


def load_index(index_name: str):
    index_file = INDEX_DIR / f"{index_name}.pkl"
    if not index_file.exists():
        logger.error(f"索引文件 {index_file} 不存在，请先运行 'python face_matcher.py build {index_name}'")
        sys.exit(1)
    with open(index_file, 'rb') as f:
        return pickle.load(f)


def search_in_album(album_name: str, query: str):
    if app is None:
        raise RuntimeError("InsightFace 未初始化")

    album_index = load_index(album_name)
    student_index = load_index("students")
    
    logger.info(f"相册 '{album_name}' 索引加载完毕，共 {len(album_index)} 个人脸向量")
    logger.info(f"学生库索引加载完毕，共 {len(student_index)} 个学生")

    matched_students = []
    for student in student_index:
        if query == student["student_id"] or query in student["student_name"]:
            matched_students.append(student)
    
    if not matched_students:
        logger.error(f"未找到匹配的学生: {query}")
        sys.exit(1)
    
    logger.info(f"找到 {len(matched_students)} 个匹配的学生")
    
    all_matched_photos = set()
    
    for student in matched_students:
        stu_emb = student['embedding']
        all_embs = np.vstack([item['embedding'] for item in album_index])
        distances = cdist(stu_emb.reshape(1, -1), all_embs, metric='cosine').flatten()
        mask = distances < SIMILARITY_THRESHOLD
        matched_indices = np.where(mask)[0]
        
        for idx in matched_indices:
            photo_rel = album_index[idx]["photo"]
            all_matched_photos.add(photo_rel)
        
        logger.info(f"学生 {student['student_id']}_{student['student_name']} 匹配到 {len(matched_indices)} 张照片")
    
    if not all_matched_photos:
        logger.warning(f"未找到包含 {query} 的任何照片")
        return
    
    output_dir = OUTPUT_DIR / album_name / query
    output_dir.mkdir(parents=True, exist_ok=True)
    
    copied = 0
    for rel_path in all_matched_photos:
        src = BASE_DIR / rel_path
        dst = output_dir / src.name
        shutil.copy2(src, dst)
        copied += 1
    
    logger.info(f"完成！已将 {copied} 张照片复制到 {output_dir}")


def api_search_in_album(album_name: str, query: str):
    """API搜索模式：直接返回照片文件名列表，不复制文件"""
    if app is None:
        raise RuntimeError("InsightFace 未初始化")

    album_index = load_index(album_name)
    student_index = load_index("students")
    
    matched_students = []
    for student in student_index:
        if query == student["student_id"] or query in student["student_name"]:
            matched_students.append(student)
    
    if not matched_students:
        print('[]')
        return
    
    all_matched_photos = set()
    
    for student in matched_students:
        stu_emb = student['embedding']
        all_embs = np.vstack([item['embedding'] for item in album_index])
        distances = cdist(stu_emb.reshape(1, -1), all_embs, metric='cosine').flatten()
        mask = distances < SIMILARITY_THRESHOLD
        matched_indices = np.where(mask)[0]
        
        for idx in matched_indices:
            photo_rel = album_index[idx]["photo"]
            # 只提取文件名
            photo_name = Path(photo_rel).name
            all_matched_photos.add(photo_name)
    
    # 输出JSON格式的照片文件名列表
    import json
    photo_names = list(all_matched_photos)
    print(json.dumps(photo_names))


def main():
    parser = argparse.ArgumentParser(description="游学照片人脸检索工具 (InsightFace)")
    subparsers = parser.add_subparsers(dest='command', help='命令')
    
    build_parser = subparsers.add_parser('build', help='构建索引')
    build_parser.add_argument('target', help='目标: 相册名称 或 students')
    build_parser.add_argument('--gpu', action='store_true', default=False, help='使用 GPU')
    build_parser.add_argument('--threads', type=int, default=8, help='CPU 线程数')
    
    search_parser = subparsers.add_parser('search', help='搜索照片（复制模式）')
    search_parser.add_argument('album', help='相册名称')
    search_parser.add_argument('query', help='学号或姓名')
    search_parser.add_argument('--gpu', action='store_true', default=False, help='使用 GPU')
    search_parser.add_argument('--threads', type=int, default=8, help='CPU 线程数')
    
    api_search_parser = subparsers.add_parser('api-search', help='API搜索（返回JSON路径列表）')
    api_search_parser.add_argument('album', help='相册名称')
    api_search_parser.add_argument('query', help='学号或姓名')
    api_search_parser.add_argument('--gpu', action='store_true', default=False, help='使用 GPU')
    api_search_parser.add_argument('--threads', type=int, default=8, help='CPU 线程数')
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        sys.exit(1)
    
    use_gpu = args.gpu if hasattr(args, 'gpu') else False
    num_threads = args.threads if hasattr(args, 'threads') else 8
    
    init_face_analysis(use_gpu=use_gpu, num_threads=num_threads)
    
    if args.command == 'build':
        if args.target == 'students':
            build_student_index()
        else:
            build_album_index(args.target)
    elif args.command == 'search':
        search_in_album(args.album, args.query)
    elif args.command == 'api-search':
        api_search_in_album(args.album, args.query)


if __name__ == "__main__":
    main()