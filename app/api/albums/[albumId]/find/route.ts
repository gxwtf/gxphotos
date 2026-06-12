import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const { albumId } = await params;
  const { query } = await request.json();

  if (!query) {
    return NextResponse.json({ error: '缺少搜索关键词' }, { status: 400 });
  }

  try {
    // 使用 api-search 命令获取照片路径列表
    const { stdout, stderr } = await execPromise(
      `python scripts/face_matcher.py api-search ${albumId} "${query}"`,
      {
        cwd: process.cwd(),
        timeout: 120000,
      }
    );

    // 只有当 stderr 包含真正的错误信息时才打印（过滤掉 INFO 级别的日志）
    if (stderr && stderr.includes('ERROR') || stderr.includes('Error') || stderr.includes('error')) {
      console.error('人脸搜索错误:', stderr);
    }

    // 解析 JSON 输出：找到最后一个 JSON 数组
    const jsonMatch = stdout.match(/\[.*\]/g);
    if (!jsonMatch || jsonMatch.length === 0) {
      console.error('未找到 JSON 输出');
      return NextResponse.json({ photos: [] });
    }
    const photoNames = JSON.parse(jsonMatch[jsonMatch.length - 1]);
    
    // 转换为 Photo 对象格式，路径为 /photos/{albumId}/{filename}
    const photos = photoNames.map((name: string) => ({
      name: name,
      path: `/photos/${albumId}/${name}`,
    }));

    return NextResponse.json({ photos });
  } catch (error) {
    console.error('搜索执行失败:', error);
    return NextResponse.json(
      { error: '搜索失败，请稍后重试' },
      { status: 500 }
    );
  }
}