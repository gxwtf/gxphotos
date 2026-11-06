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
- **图片展示**: 自研照片展示组件（构建期用 sharp 生成 WebP 缩略图）
- **拍摄时间**: exif-parser（读取 EXIF 时间与相机信息）
- **主题**: next-themes（深色模式跟随系统，可手动切换）
- **人脸检索**: InsightFace (Python)

## 快速开始

### 环境要求

- Node.js 20.9+（Next.js 16 的要求）
- Python 3.9+（仅用于人脸检索功能，建议放在独立虚拟环境里）
- pnpm（推荐）或 npm/yarn

### 安装依赖

```bash
pnpm install
cp .env.example .env
```

`.env` 里至少要配好 `PHOTOS_DIR` —— 原图目录，必须指向**项目之外**的绝对路径（原因见「如何部署」）。

### 运行开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000 查看结果。

开发期没有 nginx，原图由 `app/photos/[...path]/route.ts` 兜底读取；生产环境该路由直接返回 404，原图统一交给 nginx 托管。

### 构建生产版本

```bash
pnpm build     # 先增量生成缩略图，再 next build
pnpm start
```

## 项目结构

原图不在项目里，由 `.env` 的 `PHOTOS_DIR` 指定；缩略图与人脸索引都是产物，不入库。

```
<PHOTOS_DIR>            # 原图目录（项目之外的绝对路径）
└── /album-001          # 相册 ID（自定义），只扫描这一层
    ├── photo1.jpg
    └── photo2.jpg

/public
├── /info               # 相册信息目录
│   └── /album-001
│       ├── info.json   # 相册元数据
│       └── cover.jpg   # 相册封面（可选）
├── /students           # 学生照片（用于人脸检索）
│   └── <学号>_<姓名>.jpg
└── /thumbs             # 缩略图（构建期生成，不入库）

/face_indexes           # 人脸索引（生成物，不入库）
```

## 如何添加相册

### 1. 创建相册文件夹

```bash
mkdir -p "$PHOTOS_DIR/your-album-id"
```

只识别相册目录**这一层**的照片，不再支持子目录分区；按天浏览由照片自身的拍摄日期自动分组。

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
  "shootDate": "2026-06-05",
  "endDate": "2026-06-09",
  "coverImage": "cover.jpg"
}
```

**字段说明**：
- `title`: 相册名称（必需，缺失时用目录名）
- `description`: 相册描述
- `location`: 拍摄地点
- `shootDate` / `endDate`: 活动起止日期，用 `YYYY-MM-DD`（相册列表按 `shootDate` 倒序）
- `coverImage`: 封面图文件名，图片放在 `public/info/<album-id>/` 下（可选）
- `liveUrl`: 原直播外链（可选）

### 4. 生成缩略图

```bash
pnpm thumbnails          # 增量：原图没变就跳过
pnpm thumbnails --force  # 全量重新生成
```

`pnpm build` 会自动跑这一步。缩略图缺失时前端会回退到原图，但原图动辄数 MB，不建议依赖这个回退。

### 5. 构建人脸索引（需要使用「找自己」时）

```bash
source <虚拟环境路径>/bin/activate
pnpm face:build <相册名称>
```

没有索引时，搜索会返回「相册索引不存在」。

## 完整示例

创建一个名为"北京之旅"的相册：

```bash
# 1. 在原图目录下创建相册
mkdir -p "$PHOTOS_DIR/beijing-trip"

# 2. 放入照片
cp /path/to/photos/*.jpg "$PHOTOS_DIR/beijing-trip/"

# 3. 创建信息文件
mkdir -p public/info/beijing-trip

# 4. 创建 info.json
cat > public/info/beijing-trip/info.json << 'EOF'
{
  "title": "北京之旅",
  "description": "北京四天三晚的旅游记录",
  "location": "北京市",
  "shootDate": "2026-06-01",
  "endDate": "2026-06-04"
}
EOF

# 5. 生成缩略图
pnpm thumbnails
```

## 项目特性

- ✅ shadcn/ui 组件库集成
- ✅ 自研照片展示组件
- ✅ 构建期预生成 WebP 缩略图，原图由 nginx 直接托管
- ✅ 支持按拍摄时间排序（正序/倒序），按拍摄日期分天浏览
- ✅ "找自己"人脸搜索功能
- ✅ 响应式设计
- ✅ 自动深色模式（跟随系统，页面右上角图标可切换浅色/深色/跟随系统）
- ✅ 无数据库，基于文件系统
- ✅ 批量下载照片功能

## 拍摄时间与排序

照片时间取自 EXIF（`DateTimeOriginal`，缺失时退回 `DateTime`，再退回文件修改时间），**不按文件名排序**。相机文件名计数器在 9999 之后会回绕到 0001，多机位混放时文件名也没有顺序，按文件名排会把「从晚到早」排错。

- 相册页默认「从晚到早」，日期 tab 按拍摄日期分组（仅在多天相册出现）；
- 拍摄时间由 `GET /api/albums/[albumId]/photos` 以 `shotDate`（`YYYY-MM-DD`）和 `shotTime`（毫秒时间戳）一起返回，同一时刻或时间缺失时才回落到文件名比较；
- 读取 EXIF 需要读入整张原图，服务端带进程内缓存（按文件大小与 mtime 失效）并并发读取，数千张的相册首次访问通常是秒级、命中缓存后毫秒级。

## 可用命令

```bash
# 开发
pnpm dev           # 启动开发服务器

# 构建
pnpm build         # 生成缩略图 + 构建生产版本
pnpm start         # 运行生产版本
pnpm thumbnails    # 只生成缩略图（--force 全量）

# 代码检查
pnpm lint          # 运行 ESLint

# 人脸检索相关（`python` 需先激活装好 scripts/requirements.txt 的虚拟环境）
pnpm face:build <目标>    # 构建人脸索引（学生库或相册）
pnpm face:search <相册> <关键词>  # 命令行搜索照片
pnpm face:serve      # 启动人脸检索 API 服务（CPU模式）
pnpm face:serve:gpu  # 启动人脸检索 API 服务（GPU模式）
pnpm face:rebase     # 迁移旧索引里的照片路径（--dry-run 只看不改）
```

## 文件映射（API 端点）

- `GET /api/albums` - 获取所有相册（按 `shootDate` 倒序）
- `GET /api/albums/[albumId]` - 获取特定相册信息（含浏览数）
- `GET /api/albums/[albumId]/photos` - 获取相册中的所有照片（含 `shotDate`、`shotTime`）
- `GET /api/albums/[albumId]/photos/[filename]/info` - 获取单张照片的大小、尺寸、拍摄时间、相机型号
- `POST /api/albums/[albumId]/find` - 人脸搜索（找自己功能）
- `GET /photos/[...path]` - 仅开发期使用，原图兜底；生产环境返回 404，由 nginx 托管

## 浏览数

相册详情页的「N 人次浏览」来自第三方计数器 [Counters](https://github.com/YangguangZhou/Counter)，通过 `POST /api/counter` 取值（返回 JSON `{"times": N}`，同时把这次访问计入）。

- 实现见 `lib/counter.ts`：超时 800ms，失败后 60s 内不再重试（期间显示 0），不会拖慢页面；
- 需要换地址或自建时设置 `COUNTER_API`；
- 上游不可用时页面显示 `0 人次浏览`，不影响其它功能，恢复后最迟 60s 自动恢复。

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
# 安装 Python 依赖（建议使用虚拟环境）
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
- API 地址：`http://<FACE_API_HOST>:<FACE_API_PORT>`（默认 `http://localhost:8001`）
- 文档地址：同上加 `/docs`

**POST /search**
```json
{
  "album": "example",
  "query": "李白"
}
```

### 注意事项

- 需要先运行人脸检索服务才能使用此功能
- 首次使用需先构建学生库索引和目标相册索引；每个相册一份索引，相册补照片后要重新 `pnpm face:build <相册名称>`
- `face_indexes/` 不入库，换机器或清空目录后必须重建，否则搜索会返回「相册索引不存在」
- `pnpm face:*` 内部调用的是 `python`（不是 `python3`），需先激活装好依赖的虚拟环境
- 服务默认端口为 8001，可通过 `--port` 参数或 `.env` 的 `FACE_API_PORT` 修改

## 自定义

### 修改样式

编辑 `app/globals.css` 和各组件中的 Tailwind 类名。

### 修改排序逻辑

照片排序在 `components/PhotoGallery.tsx`（按 `shotTime`），相册列表排序在 `app/albums/page.tsx`。

### 添加更多字段

编辑 `info.json` 文件，添加更多字段（如相机型号、镜头等），然后在组件中使用。

## 常见问题

### 如何修改相册 ID？
相册 ID 就是文件夹名称。更改 `<PHOTOS_DIR>/{album_id}` 中的文件夹名称，并同步修改 `public/info/{album_id}` 即可。

### 照片没有显示？
- 确认照片放在 `<PHOTOS_DIR>/<album_id>/` 下（只扫这一层，子目录读不到）
- 确认 `PHOTOS_DIR` 与 nginx 里 `/photos/` 的 `alias` 指向同一个目录
- 确认缩略图已生成（`pnpm thumbnails`），或原图本身可以访问
- 确保相册 ID 在两个位置都匹配：
  - `<PHOTOS_DIR>/[album_id]/`
  - `/public/info/[album_id]/`

### 缩略图不更新？
缩略图按 mtime 增量生成，原图被替换但修改时间更早时会跳过，执行 `pnpm thumbnails --force`。

### "找自己"提示相册索引不存在？
执行 `pnpm face:build <相册名称>`；如果提示 `python: not found`，说明没激活虚拟环境。

### 浏览数一直是 0？
第三方计数器服务不可用时会这样，可以先确认上游是否正常：

```bash
curl -X POST https://counter.jerryz.com.cn/api/counter \
  -H "Content-Type: application/json" -d '{"name": "test"}'
```

### 如何部署？
本项目依赖本地文件系统和一个常驻的 Python 人脸服务，不适合纯静态托管：

```bash
pnpm install
cp .env.example .env    # 配好 PHOTOS_DIR
pnpm build
pnpm start -p 3000
```

用 nginx 托管原图并反代 Next（示例见 `deploy/nginx.example.conf`），再用 systemd 之类的进程管理器守护 `pnpm start`。

`PHOTOS_DIR` 必须放在项目之外：`next build` 会读取并驻留项目树内的文件，几十 GB 原图放在项目里会直接把构建打爆（内存不足）。

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
