# 照片直播相册项目 - 快速入门

## ✅ 项目已完成

你的照片直播相册项目已成功创建并配置完毕！

## 🚀 快速开始

### 1. 访问应用
开发服务器已运行，访问：**http://localhost:3000**

### 2. 添加第一个相册

创建示例相册的命令：

```bash
# 创建相册文件夹结构
mkdir -p public/photos/my-album/photos

# 创建信息文件夹
mkdir -p public/info/my-album

# 创建 info.json
cat > public/info/my-album/info.json << 'EOF'
{
  "title": "我的第一个相册",
  "description": "美好的回忆",
  "location": "地球",
  "shootDate": "2026-06-12T00:00:00Z"
}
EOF
```

### 3. 添加照片

将你的照片放入 `public/photos/my-album/photos/` 文件夹

支持格式：
- 📷 图片：jpg, jpeg, png, gif, webp  
- 🎬 视频：mp4, webm, mov, avi, mkv

### 4. 页面功能

访问 http://localhost:3000/albums 查看：
- ✅ 所有相册卡片展示
- ✅ 按拍摄时间排序（倒序/正序）
- ✅ 点击相册查看详情
- ✅ lightGallery 照片/视频预览
- ✅ 缩略图、全屏、缩放等功能

## 📁 项目结构说明

```
/public
├── /photos           # 照片存储目录
│   └── /my-album     # 相册 ID (自定义名称)
│       └── /photos   # 分区 (可有多个)
│           ├── photo1.jpg
│           └── photo2.jpg
│
└── /info             # 相册元数据目录
    └── /my-album
        └── info.json # 相册信息
```

## 📋 info.json 格式

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
- `title` - 相册名称 (必需)
- `description` - 相册描述
- `location` - 拍摄地点  
- `shootDate` - 开始日期 (ISO 8601 格式)
- `endDate` - 结束日期 (可选)

## 🎨 项目特性

- ✨ 基于 Next.js 16 + React 19
- 🎯 shadcn/ui 组件库
- 🖼️ lightGallery 照片预览
- 📱 完全响应式设计
- 🎬 支持照片和视频
- 📊 按拍摄时间排序
- 🗂️ 支持分区组织
- ⚡ 无数据库（基于文件系统）

## 🔧 可用命令

```bash
# 开发
pnpm dev           # 启动开发服务器

# 构建
pnpm build         # 构建生产版本
pnpm start         # 运行生产版本

# 代码检查
pnpm lint          # 运行 ESLint
```

## 📖 更多信息

详细文档见 `PHOTO_ALBUMS_README.md`

## 💡 常见问题

### 如何修改相册ID？
相册ID就是文件夹名称。更改 `/public/photos/{album_id}` 中的文件夹名称即可。

### 如何添加多个分区？
在相册文件夹下创建多个分区文件夹：
```bash
mkdir -p public/photos/my-album/day1
mkdir -p public/photos/my-album/day2
```

### 照片没有显示？
- 确保照片放在正确的分区文件夹中
- 确保相册ID在两个位置都匹配：
  - `/public/photos/[album_id]/`
  - `/public/info/[album_id]/`

### 如何部署？
```bash
pnpm build
pnpm start
# 然后用你的服务器（Vercel, Netlify等）部署
```

## 🎓 示例相册

项目中包含一个示例相册 `album-001`（北京师范大学附属实验中学 2026 年高二社会实践课程）

## 🤝 需要帮助？

查看各文件中的代码注释或 `PHOTO_ALBUMS_README.md` 获取更多信息。

---

**祝你使用愉快！🎉**
