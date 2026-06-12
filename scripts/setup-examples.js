import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// 这是一个简单的脚本，用于生成示例数据
// 在实际使用中，你可以直接复制照片到相应的文件夹

const exampleAlbumInfo = {
    "album-001": {
        title: "文脉铸魂守初心·青春接力新长征",
        description: "北京师范大学附属实验中学2027届高二学部重庆三峡线路社会实践活动",
        location: "云南 丽江"
    }
};

console.log('示例相册配置：');
console.log(JSON.stringify(exampleAlbumInfo, null, 2));
