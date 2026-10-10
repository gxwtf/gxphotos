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
  4. 索引路径迁移（不重算 embedding）： python scripts/face_matcher.py rebase --dry-run
  5. 查看帮助：       python scripts/face_matcher.py --help

路径约定：
  原图已移出仓库，由 nginx 托管，根目录通过环境变量 PHOTOS_DIR 注入
  （Node 与 Python 共用同一变量）。索引 pkl 里的 "photo" 字段存的是
  「相册内相对路径」（如 xxx.jpg 或 sub/xxx.jpg），学生库索引存的是
  「学生库内相对路径」。旧索引（public/photos/... 形式）可用 rebase 子命令
  纯路径改写，不需要重新计算 embedding。
"""

import os
import re
import sys
import pickle
import shutil
import argparse
import datetime
from pathlib import Path
import logging

# 加载环境变量（Node 与 Python 共用 .env，PHOTOS_DIR / STUDENT_DIR 由此注入）
from dotenv import load_dotenv
load_dotenv()

# 重依赖（numpy/scipy/cv2/insightface/onnxruntime/tqdm）：缺失时不让 CLI 直接崩，
# 这样 --help 与 rebase（纯 pkl 路径改写）在没装推理依赖的机器上也能用。
_RUNTIME_IMPORT_ERROR = None
try:
    import numpy as np
    from scipy.spatial.distance import cdist
    import cv2
    from tqdm import tqdm

    import insightface
    from insightface.app import FaceAnalysis
    import onnxruntime as ort
except ImportError as e:  # pragma: no cover - 取决于部署环境
    np = cdist = cv2 = tqdm = insightface = FaceAnalysis = ort = None
    _RUNTIME_IMPORT_ERROR = e

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stderr)
logger = logging.getLogger(__name__)


def require_runtime_deps():
    """需要 InsightFace 推理能力的子命令在入口处调用（rebase / --help 不需要）。"""
    if _RUNTIME_IMPORT_ERROR is not None:
        logger.error(f"缺少推理依赖，无法执行该命令: {_RUNTIME_IMPORT_ERROR}")
        logger.error("请先安装: pip install -r scripts/requirements.txt")
        sys.exit(1)

# ========== 配置 ==========
BASE_DIR = Path(__file__).parent.parent.resolve()


def _resolve_dir(env_value, fallback):
    """环境变量目录：空则用默认值；相对路径按项目根解析（与 lib/paths.ts 语义一致）。"""
    value = (env_value or "").strip()
    if not value:
        return fallback
    path = Path(value).expanduser()
    return path if path.is_absolute() else (BASE_DIR / path)


# 原图已移出仓库（next build 会读入项目树内所有文件），默认开发期目录为项目根下、public 之外
PHOTOS_DIR = _resolve_dir(os.getenv("PHOTOS_DIR"), BASE_DIR / "photos_data")  # 相册照片目录
STUDENT_DIR = _resolve_dir(os.getenv("STUDENT_DIR"), BASE_DIR / "public" / "students")  # 学生大头照目录
OUTPUT_DIR = BASE_DIR / "public" / "search_results"  # 查询结果输出目录（必须在 public 下）
INDEX_DIR = BASE_DIR / "face_indexes"                # 索引缓存目录

# 索引里 "photo" 字段的历史前缀（rebase / 向后兼容归一化用）
LEGACY_PHOTO_PREFIXES = (
    "public/photos/",
    "public/students/",
    "photos_data/",
)
# 兜底：匹配任意前缀下的 public/photos/<相册>/ 或 public/students/
LEGACY_ALBUM_RE = re.compile(r"(?:^|.*/)public/photos/[^/]+/")
LEGACY_STUDENT_RE = re.compile(r"(?:^|.*/)public/students/")
LEGACY_PHOTOS_DATA_RE = re.compile(r"(?:^|.*/)photos_data/[^/]+/")

# InsightFace 参数
SIMILARITY_THRESHOLD = 0.5
SUPPORTED_FORMATS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
# ==========================

# 全局应用实例
app = None


def strip_known_prefix(path_str, base_dir=None, extra_prefixes=()):
    """把索引里固化的路径剥成「目录内相对路径」。

    依次尝试：显式前缀 -> 配置的绝对目录 -> 历史式正则（public/photos/<相册>/ 等）。
    都不匹配时返回 None（表示无法识别，调用方应保留原值）。
    """
    if not isinstance(path_str, str) or not path_str:
        return None

    text = path_str.replace("\\", "/")

    prefixes = []
    if base_dir is not None:
        prefixes.append(str(Path(base_dir).resolve()).replace("\\", "/"))
    prefixes.append(str(Path(PHOTOS_DIR).resolve()).replace("\\", "/"))
    prefixes.append(str(Path(STUDENT_DIR).resolve()).replace("\\", "/"))
    prefixes.extend(extra_prefixes)

    for prefix in prefixes:
        prefix = str(prefix).replace("\\", "/").rstrip("/")
        if not prefix:
            continue
        if text == prefix:
            return ""
        if text.startswith(prefix + "/"):
            return text[len(prefix) + 1:]

    for rel_prefix in LEGACY_PHOTO_PREFIXES:
        if text.startswith(rel_prefix):
            return text[len(rel_prefix):]

    for pattern in (LEGACY_ALBUM_RE, LEGACY_STUDENT_RE, LEGACY_PHOTOS_DATA_RE):
        matched = pattern.match(text)
        if matched:
            return text[matched.end():]

    return None


def drop_leading_segment(relative, segment):
    """剥掉已知前缀后，若首段仍是相册名/学生库名，一并去掉（统一成目录内相对路径）。"""
    if relative is None:
        return None
    parts = [p for p in relative.replace("\\", "/").split("/") if p not in ("", ".")]
    if parts and segment and parts[0] == segment:
        parts = parts[1:]
    return "/".join(parts)


def normalize_photo_path(photo_rel, album_name):
    """把索引里的 "photo" 值归一化成「相册内相对路径」（兜底向后兼容）。

    已经 rebase 过的索引取出即为相册内相对路径，原样返回；旧索引（带
    public/photos/<相册>/、photos_data/<相册>/ 或绝对 PHOTOS_DIR 前缀）会被剥掉
    前缀与相册名，因此 rebase 之前也不会立刻崩。
    """
    relative = strip_known_prefix(photo_rel, base_dir=PHOTOS_DIR / album_name)
    if relative is None:
        return photo_rel
    return drop_leading_segment(relative, album_name)


def photo_path_for_storage(img_path, root_dir):
    """写入索引时统一存成「相对于 root_dir 的路径」（相册内 / 学生库内相对路径）。"""
    try:
        return str(img_path.relative_to(root_dir))
    except ValueError:
        stripped = strip_known_prefix(str(img_path), base_dir=root_dir)
        if stripped is not None:
            return stripped
        logger.warning(f"路径不在预期根目录内，按原值写入索引: {img_path}")
        return str(img_path)


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


def build_album_index(album_name: str, index_dir: Path = None):
    index_dir = index_dir or INDEX_DIR
    album_dir = PHOTOS_DIR / album_name
    if not album_dir.exists():
        logger.error(f"相册目录不存在: {album_dir}")
        sys.exit(1)

    index_dir.mkdir(parents=True, exist_ok=True)
    index_file = index_dir / f"{album_name}.pkl"

    logger.info(f"开始构建相册 '{album_name}' 的人脸索引...")
    image_files = [f for f in album_dir.rglob("*") if f.suffix.lower() in SUPPORTED_FORMATS]
    logger.info(f"共发现 {len(image_files)} 张图片")

    index_data = []
    total_faces = 0

    for img_path in tqdm(image_files, desc="处理图片", unit="张"):
        faces = extract_embeddings_from_image(img_path)
        for emb, area, det_score in faces:
            index_data.append({
                "photo": photo_path_for_storage(img_path, album_dir),
                "embedding": emb,
                "facial_area": area
            })
        total_faces += len(faces)

    with open(index_file, 'wb') as f:
        pickle.dump(index_data, f)
    logger.info(f"索引构建完成！共 {len(index_data)} 个人脸向量，已保存至 {index_file}")


def build_student_index(index_dir: Path = None):
    index_dir = index_dir or INDEX_DIR
    index_dir.mkdir(parents=True, exist_ok=True)
    index_file = index_dir / "students.pkl"

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
            "photo": photo_path_for_storage(img_path, STUDENT_DIR),
            "embedding": emb
        })

    with open(index_file, 'wb') as f:
        pickle.dump(index_data, f)
    logger.info(f"学生库索引构建完成！共 {len(index_data)} 个学生，已保存至 {index_file}")


def load_index(index_name: str, index_dir: Path = None):
    index_file = (index_dir or INDEX_DIR) / f"{index_name}.pkl"
    if not index_file.exists():
        logger.error(f"索引文件 {index_file} 不存在，请先运行 'python face_matcher.py build {index_name}'")
        sys.exit(1)
    with open(index_file, 'rb') as f:
        return pickle.load(f)


def search_in_album(album_name: str, query: str, index_dir: Path = None):
    if app is None:
        raise RuntimeError("InsightFace 未初始化")

    album_index = load_index(album_name, index_dir=index_dir)
    student_index = load_index("students", index_dir=index_dir)
    
    logger.info(f"相册 '{album_name}' 索引加载完毕，共 {len(album_index)} 个人脸向量")
    logger.info(f"学生库索引加载完毕，共 {len(student_index)} 个学生")

    matched_students = []
    for student in student_index:
        if query == student["student_id"] or query == student["student_name"]:
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
        # 索引存的是相册内相对路径；旧索引可能仍带已知前缀，这里兜底归一化
        rel_path = normalize_photo_path(rel_path, album_name)
        src = PHOTOS_DIR / album_name / rel_path
        dst = output_dir / src.name
        shutil.copy2(src, dst)
        copied += 1
    
    logger.info(f"完成！已将 {copied} 张照片复制到 {output_dir}")


def api_search_in_album(album_name: str, query: str, index_dir: Path = None):
    """API搜索模式：直接返回照片文件名列表，不复制文件"""
    if app is None:
        raise RuntimeError("InsightFace 未初始化")

    album_index = load_index(album_name, index_dir=index_dir)
    student_index = load_index("students", index_dir=index_dir)
    
    matched_students = []
    for student in student_index:
        if query == student["student_id"] or query == student["student_name"]:
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


def _unwrap_index(data):
    """探测 pkl 实际结构：list[dict] 直接返回，dict 包装则找出条目列表。

    返回 (条目列表, 包装键名 或 None)；结构不认识时返回 (None, None)。
    """
    if isinstance(data, list):
        return data, None
    if isinstance(data, dict):
        for key in ("photos", "items", "data", "index", "entries"):
            value = data.get(key)
            if isinstance(value, list) and (not value or isinstance(value[0], dict)):
                return value, key
        for key, value in data.items():
            if isinstance(value, list) and value and isinstance(value[0], dict):
                return value, key
    return None, None


def _rebase_entries(entries, album_name, is_students, stats):
    """就地改写条目里的 "photo" 字段，返回改写的条目数（其它字段一律不动）。"""
    changed = 0
    for entry in entries:
        if not isinstance(entry, dict) or "photo" not in entry:
            stats["skipped"] += 1
            continue

        old = entry["photo"]
        if is_students:
            new = strip_known_prefix(old, base_dir=STUDENT_DIR)
            new = drop_leading_segment(new, "students")
        else:
            new = strip_known_prefix(old, base_dir=PHOTOS_DIR / album_name)
            new = drop_leading_segment(new, album_name)

        if new is None:
            # 已是相对路径（无已知前缀）就原样保留；看起来仍是固化的绝对/越界路径则记为未识别
            stats["skipped"] += 1
            if isinstance(old, str) and (old.startswith("/") or old.startswith("../")):
                stats["unrecognized"] += 1
                logger.warning(f"  未识别前缀，保留原值: {old!r}")
            continue

        if new == old:
            stats["skipped"] += 1
            continue

        entry["photo"] = new
        changed += 1
        stats["rewritten"] += 1
        if stats["show_detail"]:
            print(f"    {old!r} -> {new!r}")
    return changed


def rebase_indexes(index_dir: Path = None, dry_run: bool = False, show_detail: bool = True):
    """纯路径改写：把 face_indexes/*.pkl 里的 "photo" 字段剥成目录内相对路径。

    不重新计算任何 embedding，只改写路径字段；写回前备份为 <原名>.bak-<时间戳>。
    幂等：已改好的路径再跑一次结果不变。
    """
    index_dir = Path(index_dir or INDEX_DIR)
    stats = {
        "files": 0,
        "rewritten": 0,
        "skipped": 0,
        "unrecognized": 0,
        "show_detail": show_detail,
    }

    pkl_files = sorted(index_dir.glob("*.pkl")) if index_dir.exists() else []
    if not pkl_files:
        logger.error(f"索引目录没有 .pkl 文件: {index_dir}")
        return stats

    timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")

    for pkl_file in pkl_files:
        with open(pkl_file, "rb") as f:
            data = pickle.load(f)

        entries, wrapper_key = _unwrap_index(data)
        if entries is None:
            logger.warning(f"跳过 {pkl_file.name}: 无法识别的索引结构 {type(data).__name__}")
            stats["unrecognized"] += 1
            continue

        is_students = pkl_file.stem == "students" or (
            bool(entries) and isinstance(entries[0], dict) and "student_id" in entries[0]
        )
        kind = "学生库" if is_students else f"相册 '{pkl_file.stem}'"

        print(f"[{'DRY-RUN' if dry_run else 'REBASE'}] {pkl_file.name} "
              f"({kind}, {len(entries)} 条"
              + (f", dict 包装键 {wrapper_key!r}" if wrapper_key else "")
              + ")")

        before = stats["rewritten"]
        changed = _rebase_entries(entries, pkl_file.stem, is_students, stats)
        stats["files"] += 1

        if changed == 0:
            print("    无需改写（已是相对路径）")
            continue

        if dry_run:
            print(f"    [dry-run] 将改写 {changed} 条，不写盘")
            continue

        backup_file = pkl_file.with_name(f"{pkl_file.name}.bak-{timestamp}")
        shutil.copy2(pkl_file, backup_file)
        with open(pkl_file, "wb") as f:
            pickle.dump(data, f)
        print(f"    已改写 {changed} 条，备份: {backup_file.name}")
        assert stats["rewritten"] - before == changed

    print("\n统计: 处理文件 {files} 个 / 改写条目 {rewritten} 条 / 跳过条目 {skipped} 条 / 未识别前缀 {unrecognized} 处"
          .format(**stats))
    if dry_run:
        print("(--dry-run：未写入任何文件，也未生成备份)")
    return stats


def main():
    parser = argparse.ArgumentParser(description="游学照片人脸检索工具 (InsightFace)")
    subparsers = parser.add_subparsers(dest='command', help='命令')
    
    build_parser = subparsers.add_parser('build', help='构建索引')
    build_parser.add_argument('target', help='目标: 相册名称 或 students')
    build_parser.add_argument('--gpu', action='store_true', default=False, help='使用 GPU')
    build_parser.add_argument('--threads', type=int, default=8, help='CPU 线程数')
    build_parser.add_argument('--index-dir', type=str, default=None, help='索引目录（默认 face_indexes）')
    
    search_parser = subparsers.add_parser('search', help='搜索照片（复制模式）')
    search_parser.add_argument('album', help='相册名称')
    search_parser.add_argument('query', help='学号或姓名')
    search_parser.add_argument('--gpu', action='store_true', default=False, help='使用 GPU')
    search_parser.add_argument('--threads', type=int, default=8, help='CPU 线程数')
    search_parser.add_argument('--index-dir', type=str, default=None, help='索引目录（默认 face_indexes）')
    
    api_search_parser = subparsers.add_parser('api-search', help='API搜索（返回JSON路径列表）')
    api_search_parser.add_argument('album', help='相册名称')
    api_search_parser.add_argument('query', help='学号或姓名')
    api_search_parser.add_argument('--gpu', action='store_true', default=False, help='使用 GPU')
    api_search_parser.add_argument('--threads', type=int, default=8, help='CPU 线程数')
    api_search_parser.add_argument('--index-dir', type=str, default=None, help='索引目录（默认 face_indexes）')
    
    rebase_parser = subparsers.add_parser(
        'rebase',
        help='纯路径改写：把索引里的 "photo" 剥成目录内相对路径（不重算 embedding，秒级）'
    )
    rebase_parser.add_argument('--index-dir', type=str, default=None, help='索引目录（默认 face_indexes）')
    rebase_parser.add_argument('--dry-run', action='store_true', default=False, help='只打印将要发生的改写与计数，不写盘')
    rebase_parser.add_argument('--quiet', action='store_true', default=False, help='不逐条打印改写明细')
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        sys.exit(1)
    
    index_dir = Path(args.index_dir).resolve() if args.index_dir else INDEX_DIR
    
    # rebase 是纯 pkl 路径改写，不需要 InsightFace/GPU 初始化
    if args.command == 'rebase':
        rebase_indexes(index_dir=index_dir, dry_run=args.dry_run, show_detail=not args.quiet)
        return
    
    use_gpu = args.gpu if hasattr(args, 'gpu') else False
    num_threads = args.threads if hasattr(args, 'threads') else 8
    
    require_runtime_deps()
    init_face_analysis(use_gpu=use_gpu, num_threads=num_threads)
    
    if args.command == 'build':
        if args.target == 'students':
            build_student_index(index_dir=index_dir)
        else:
            build_album_index(args.target, index_dir=index_dir)
    elif args.command == 'search':
        search_in_album(args.album, args.query, index_dir=index_dir)
    elif args.command == 'api-search':
        api_search_in_album(args.album, args.query, index_dir=index_dir)


if __name__ == "__main__":
    main()