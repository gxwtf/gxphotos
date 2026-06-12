# 照片直播相册项目

这是一个使用 Next.js、shadcn/ui 和 lightGallery 构建的照片/视频直播展示项目。

## 项目结构

```
/public
  /photos          # 照片/视频存储目录
    /album-001     # 相册 ID（自定义）
      /summer      # 分区名称（可选）
        photo1.jpg
        photo2.jpg
        video.mp4
      /winter      # 另一个分区
        ...
  /info            # 相册信息目录
    /album-001
      info.json    # 相册元数据
```

## 如何添加相册

### 1. 创建相册文件夹结构

在 `/public/photos/` 下创建一个相册文件夹，用相册 ID 作为文件夹名称（例如 `album-001`）：

```bash
mkdir -p public/photos/your-album-id/partition-name
```

### 2. 添加照片/视频

将照片或视频文件放入相册的分区文件夹中。支持的格式：

- **图片**：jpg, jpeg, png, gif, webp
- **视频**：mp4, webm, mov, avi, mkv

### 3. 创建相册信息

在 `/public/info/` 下创建对应的相册 ID 文件夹：

```bash
mkdir -p public/info/your-album-id
```

然后创建 `info.json` 文件：

```json
{
  "title": "相册标题",
  "description": "相册描述",
  "location": "拍摄地点",
  "shootDate": "2026-06-05T00:00:00Z",
  "endDate": "2026-06-09T00:00:00Z"
}
```

**字段说明：**
- `title`: 相册名称（必需）
- `description`: 相册描述
- `location`: 拍摄地点
- `shootDate`: 开始拍摄时间（ISO 8601 格式）
- `endDate`: 结束拍摄时间（可选）

## 项目特性

- ✅ shadcn/ui 组件库集成
- ✅ lightGallery 实现照片/视频预览
- ✅ 支持按拍摄时间排序（正序/倒序）
- ✅ 响应式设计
- ✅ 支持分区组织照片
- ✅ 无数据库，基于文件系统

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 运行开发服务器

```bash
pnpm dev
```

访问 `http://localhost:3000`

### 3. 构建生产版本

```bash
pnpm build
pnpm start
```

## 完整示例

假设你要创建一个名为 "北京之旅" 的相册：

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

## 文件映射

应用会自动扫描 `/public/photos` 和 `/public/info` 目录，并通过以下 API 端点提供数据：

- `GET /api/albums` - 获取所有相册
- `GET /api/albums/[albumId]` - 获取特定相册信息
- `GET /api/albums/[albumId]/photos` - 获取相册中的所有照片

## 自定义

### 修改样式

编辑 `app/globals.css` 和各组件中的 Tailwind 类名。

### 修改排序逻辑

在 `app/albums/page.tsx` 和 `app/albums/[albumId]/page.tsx` 中修改 `sortedAlbums` 逻辑。

### 添加更多字段

编辑 `info.json` 文件，添加更多字段（如相机型号、镜头等），然后在组件中使用。

## 技术栈

- **框架**: Next.js 16
- **UI 组件**: shadcn/ui
- **图库**: lightGallery 2.8
- **样式**: Tailwind CSS
- **语言**: TypeScript

## 许可

MIT
