# 人脸检索工具使用指南

## 概述

本工具基于 InsightFace 实现人脸检索功能，支持在游学相册中通过姓名或学号查找包含特定学生的照片。

## 环境要求

- Python 3.8+
- 依赖库：`numpy`, `scipy`, `opencv-python`, `insightface`, `onnxruntime`, `tqdm`

## 快速开始

### 1. 安装依赖

```bash
pip install -r scripts/requirements.txt
```

### 2. 构建索引

#### 构建学生库索引

```bash
# 使用 CPU（默认8线程）
pnpm face:build students

# 使用 CPU，指定线程数
pnpm face:build students --threads 4

# 使用 GPU（需要 CUDA 环境）
pnpm face:build students --gpu
```

#### 构建相册索引

```bash
# 构建指定相册的人脸索引
pnpm face:build <相册名称>

# 例如：构建 example 相册
pnpm face:build example

# 使用 GPU
pnpm face:build example --gpu

# 指定 CPU 线程数
pnpm face:build example --threads 4
```

### 3. 查询照片（命令行模式）

```bash
# 通过学号搜索
pnpm face:search <相册名称> <学号>

# 通过姓名搜索
pnpm face:search <相册名称> <姓名>

# 例如：在 example 相册中搜索李白
pnpm face:search example 李白

# 或通过学号搜索
pnpm face:search example 20242401
```

### 4. 前端页面搜索

访问相册详情页面，点击"找自己"按钮进入搜索页面：

```
/albums/{albumId}/find
```

输入姓名或学号即可搜索匹配的照片。

## pnpm 命令说明

| 命令 | 说明 | 示例 |
|------|------|------|
| `pnpm face:build <目标>` | 构建索引（学生库或相册） | `pnpm face:build students` |
| `pnpm face:search <相册> <关键词>` | 命令行搜索照片 | `pnpm face:search example 李白` |

## 索引文件存储

索引文件存储在 `face_indexes/` 目录下：

- 学生库索引：`face_indexes/students.pkl`
- 相册索引：`face_indexes/<相册名称>.pkl`

## 学生照片格式

学生大头照需存储在 `public/students/` 目录下，文件命名格式：

```
<学号>_<姓名>.jpg
```

例如：`20242152_叶一琳.jpg`

## API 接口

### 搜索接口

**POST** `/api/albums/{albumId}/find`

请求体：
```json
{
  "query": "李白"
}
```

响应：
```json
{
  "photos": [
    {"name": "BIY04346.JPG", "path": "/photos/example/BIY04346.JPG"},
    {"name": "BIY04390.JPG", "path": "/photos/example/BIY04390.JPG"}
  ]
}
```

## 注意事项

1. 首次使用需先构建学生库索引和目标相册索引
2. 搜索结果基于余弦相似度匹配，阈值为 0.5
3. GPU 模式需要安装 CUDA 环境并配置正确
4. 建议定期重新构建索引以包含新增照片