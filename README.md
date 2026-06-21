# Guangfang Photos

一个基于 Next.js 构建的现代化照片直播应用。

## 项目简介

Guangfang Photos 是一个现代化的照片直播平台，提供实时的照片展示和分享功能。支持照片展示、人脸检索（找自己）等功能。

## 技术栈

- **框架**: Next.js 16
- **前端**: React 19
- **样式**: Tailwind CSS 4
- **语言**: TypeScript
- **UI 组件**: shadcn/ui
- **图片展示**: 自研照片展示组件
- **人脸检索**: InsightFace (Python)

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.8+（仅用于人脸检索功能）
- pnpm（推荐）或 npm/yarn

### 安装依赖

```bash
pnpm install
```

### 运行开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000 查看结果。

### 构建生产版本

```bash
pnpm build
pnpm start
```

## 项目结构

```
/public
├── /photos          # 照片存储目录
│   └── /album-001   # 相册 ID（自定义）
│       ├── /summer  # 分区名称（可选）
│       │   ├── photo1.jpg
│       │   └── photo2.jpg
│       └── /winter  # 另一个分区
│           └── ...
├── /info            # 相册信息目录
│   └── /album-001
│       └── info.json # 相册元数据
└── /students        # 学生照片（用于人脸检索）
    └── <学号>_<姓名>.jpg
```

## 如何添加相册

### 1. 创建相册文件夹结构

```bash
mkdir -p public/photos/your-album-id/partition-name
```

### 2. 添加照片

支持的格式：
- **图片**: jpg, jpeg, png, gif, webp

### 3. 创建相册信息

```bash
mkdir -p public/info/your-album-id
```

创建 `info.json` 文件：

```json
{
  "title": "相册标题",
  "description": "相册描述",
  "location": "拍摄地点",
  "shootDate": "2026-06-05T00:00:00Z",
  "endDate": "2026-06-09T00:00:00Z"
}
```

**字段说明**：
- `title`: 相册名称（必需）
- `description`: 相册描述
- `location`: 拍摄地点
- `shootDate`: 开始拍摄时间（ISO 8601 格式）
- `endDate`: 结束拍摄时间（可选）

## 完整示例

创建一个名为"北京之旅"的相册：

```bash
# 1. 创建照片结构
mkdir -p public/photos/beijing-trip/day1
mkdir -p public/photos/beijing-trip/day2

# 2. 放入照片
cp /path/to/photos/* public/photos/beijing-trip/day1/

# 3. 创建信息文件
mkdir -p public/info/beijing-trip

# 4. 创建 info.json
cat > public/info/beijing-trip/info.json << 'EOF'
{
  "title": "北京之旅",
  "description": "北京四天三晚的旅游记录",
  "location": "北京市",
  "shootDate": "2026-06-01T00:00:00Z",
  "endDate": "2026-06-04T00:00:00Z"
}
EOF
```

## 项目特性

- ✅ shadcn/ui 组件库集成
- ✅ 自研照片展示组件
- ✅ 支持按拍摄时间排序（正序/倒序）
- ✅ "找自己"人脸搜索功能
- ✅ 响应式设计
- ✅ 支持分区组织照片
- ✅ 无数据库，基于文件系统
- ✅ 批量下载照片功能

## 可用命令

```bash
# 开发
pnpm dev           # 启动开发服务器

# 构建
pnpm build         # 构建生产版本
pnpm start         # 运行生产版本

# 代码检查
pnpm lint          # 运行 ESLint

# 人脸检索相关
pnpm face:build <目标>    # 构建人脸索引（学生库或相册）
pnpm face:search <相册> <关键词>  # 命令行搜索照片
pnpm face:serve      # 启动人脸检索 API 服务（CPU模式）
pnpm face:serve:gpu  # 启动人脸检索 API 服务（GPU模式）
```

## 文件映射（API 端点）

- `GET /api/albums` - 获取所有相册
- `GET /api/albums/[albumId]` - 获取特定相册信息
- `GET /api/albums/[albumId]/photos` - 获取相册中的所有照片
- `POST /api/albums/[albumId]/find` - 人脸搜索（找自己功能）

## 找自己功能

### 功能介绍

"找自己"功能允许用户通过输入姓名或数字校园号，在相册中自动找到包含自己的所有照片。该功能基于人脸检测和人脸识别技术实现。

### 使用方法

1. 在相册详情页面点击"找自己"按钮
2. 输入姓名或数字校园号
3. 点击搜索，系统会自动识别照片中的人脸并匹配
4. 搜索结果会展示所有包含该人物的照片
5. 支持批量选择和下载照片（单次最多 100 张）

### 人脸匹配服务部署

```bash
# 安装 Python 依赖
pip install -r scripts/requirements.txt

# 构建学生库索引（首次使用）
pnpm face:build students

# 构建相册索引
pnpm face:build <相册名称>

# 启动人脸搜索服务（CPU模式）
pnpm face:serve

# 使用 GPU 加速（需要 CUDA 环境）
pnpm face:serve:gpu
```

### API 使用示例

```bash
curl -X POST http://localhost:3000/api/albums/your-album-id/find \
  -H "Content-Type: application/json" \
  -d '{"query": "张三"}'
```

### 学生照片格式

学生大头照需存储在 `public/students/` 目录下，文件命名格式：

```
<学号>_<姓名>.jpg
```

例如：`20242901_李白.jpg`

### 人脸检索服务 API

服务启动后：
- API 地址：http://localhost:8001
- 文档地址：http://localhost:8001/docs

**POST /search**
```json
{
  "album": "example",
  "query": "李白"
}
```

### 注意事项

- 需要先运行人脸检索服务才能使用此功能
- 首次使用需先构建学生库索引和目标相册索引
- 人脸索引需要定期更新以包含新增照片
- 服务默认端口为 8001，可通过 `--port` 参数修改

## 自定义

### 修改样式

编辑 `app/globals.css` 和各组件中的 Tailwind 类名。

### 修改排序逻辑

在 `app/albums/page.tsx` 和 `app/albums/[albumId]/page.tsx` 中修改排序逻辑。

### 添加更多字段

编辑 `info.json` 文件，添加更多字段（如相机型号、镜头等），然后在组件中使用。

## 常见问题

### 如何修改相册 ID？
相册 ID 就是文件夹名称。更改 `/public/photos/{album_id}` 中的文件夹名称即可。

### 如何添加多个分区？
在相册文件夹下创建多个分区文件夹：
```bash
mkdir -p public/photos/my-album/day1
mkdir -p public/photos/my-album/day2
```

### 照片没有显示？
- 确保照片放在正确的分区文件夹中
- 确保相册 ID 在两个位置都匹配：
  - `/public/photos/[album_id]/`
  - `/public/info/[album_id]/`

### 如何部署？
```bash
pnpm build
pnpm start
# 然后用你的服务器（Vercel, Netlify 等）部署
```

## 许可证

本项目采用 GNU General Public License v3.0 (GPLv3) 许可证。

### 许可证说明

本程序是自由软件：您可以根据自由软件基金会发布的 GNU 通用公共许可证的条款（第 3 版）或（根据您的选择）任何后续版本重新分发和/或修改它。

分发本程序是希望它有用，但没有任何担保；甚至没有对适销性或特定用途适用性的暗示担保。有关更多详细信息，请参阅 GNU 通用公共许可证。

您应该已经收到 GNU 通用公共许可证的副本以及本程序。如果没有，请参阅 https://www.gnu.org/licenses/。

### 核心权利

- **自由使用**: 您可以出于任何目的运行本程序
- **自由研究**: 您可以研究本程序如何工作，并进行修改以满足您的需求
- **自由分发**: 您可以重新分发本程序的副本以帮助他人
- **自由改进**: 您可以分发修改后的版本以使整个社区受益

### 重要义务

如果您分发本程序或其衍生作品，您必须：
1. 提供完整的源代码
2. 保持相同的 GPLv3 许可证
3. 说明您对原始代码所做的更改
4. 包含原始版权声明和许可证副本

完整许可证文本请参见 [LICENSE](LICENSE) 文件。