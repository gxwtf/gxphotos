'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PhotoGallery from '@/components/PhotoGallery';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Search, User, Download, AlertCircleIcon, CheckCircle2Icon } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Photo {
  name: string;
  path: string;
  shotDate?: string;
}

export default function FindYourselfPage() {
  const params = useParams();
  const router = useRouter();
  const albumId = params.albumId as string;

  const [query, setQuery] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [visiblePhotoPaths, setVisiblePhotoPaths] = useState<string[]>([]);
  const [showLimitAlert, setShowLimitAlert] = useState(false);
  const [downloadCount, setDownloadCount] = useState(0);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);

  const MAX_DOWNLOAD = 100;

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setNotFound(false);

    try {
      const res = await fetch(`/api/albums/${albumId}/find`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) throw new Error('搜索失败');

      const data = await res.json();
      setPhotos(data.photos || []);
      setNotFound(data.photos?.length === 0);
    } catch (error) {
      console.error('搜索错误:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  useEffect(() => {
    setPhotos([]);
    setSearched(false);
    setNotFound(false);
  }, [albumId]);

  // 自动关闭 toast
  useEffect(() => {
    if (showLimitAlert) {
      const timer = setTimeout(() => setShowLimitAlert(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showLimitAlert]);

  useEffect(() => {
    if (showSuccessAlert) {
      const timer = setTimeout(() => setShowSuccessAlert(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessAlert]);

  const handleDownload = async () => {
    if (selectedPhotos.size === 0) return;

    if (selectedPhotos.size > MAX_DOWNLOAD) {
      setShowLimitAlert(true);
      return;
    }

    const photosList = Array.from(selectedPhotos);
    for (let i = 0; i < photosList.length; i++) {
      const photoPath = photosList[i];
      const res = await fetch(photoPath);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photoPath.split('/').pop() || `photo_${i}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    const count = photosList.length;
    setDownloadCount(count);
    setShowSuccessAlert(true);
    setSelectionMode(false);
    setSelectedPhotos(new Set());
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 返回按钮 */}
        <Button
          variant="ghost"
          onClick={() => router.push(`/albums/${albumId}`)}
          className="mb-8 flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          返回相册
        </Button>

        {/* 页面标题 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-6">
            <User className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">找自己</h1>
          <p className="text-gray-600 max-w-md mx-auto">
            输入你的姓名或数字校园号，帮你在相册中找到你的所有照片
          </p>
        </div>

        {/* 搜索框 */}
        <div className="flex gap-3 mb-8 max-w-xl mx-auto">
          <Input
            type="text"
            placeholder="输入姓名或数字校园号..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            className="flex-1 text-lg"
          />
          <Button onClick={handleSearch} disabled={loading || !query.trim()} >
            {loading ? (
              <>
                <Spinner className="w-5 h-5" />
                搜索中
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                搜索
              </>
            )}
          </Button>
        </div>

        {/* 搜索结果 */}
        {loading ? (
          <div className="text-center">
            <Spinner className="w-8 h-8 mx-auto mb-4" />
            <p className="text-gray-500">正在搜索中...</p>
          </div>
        ) : searched && notFound ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg mb-2">未找到相关照片</p>
            <p className="text-gray-400">请尝试使用不同的关键词搜索</p>
          </div>
        ) : searched && photos.length > 0 ? (
          <div>
            <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xl font-semibold text-gray-800 whitespace-nowrap">
                找到 {photos.length} 张包含你的照片
              </h2>
              {selectionMode ? (
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <Button onClick={handleDownload} disabled={selectedPhotos.size === 0} size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    下载选中 ({selectedPhotos.size})
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setSelectionMode(false);
                    setSelectedPhotos(new Set());
                  }}>
                    取消
                  </Button>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={visiblePhotoPaths.length > 0 && visiblePhotoPaths.every(p => selectedPhotos.has(p))}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPhotos(prev => {
                            const next = new Set(prev);
                            const toAdd = visiblePhotoPaths.slice(0, MAX_DOWNLOAD);
                            toAdd.forEach(p => next.add(p));
                            if (visiblePhotoPaths.length > MAX_DOWNLOAD) {
                              setShowLimitAlert(true);
                            }
                            return next;
                          });
                        } else {
                          setSelectedPhotos(prev => {
                            const next = new Set(prev);
                            visiblePhotoPaths.forEach(p => next.delete(p));
                            return next;
                          });
                        }
                      }}
                    />
                    <span className="text-sm">全选</span>
                  </label>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>
                  <Download className="w-4 h-4 mr-2" />
                  批量下载
                </Button>
              )}
            </div>
            <PhotoGallery
              photos={photos}
              selectionMode={selectionMode}
              selectedPhotos={selectedPhotos}
              onSelectionChange={setSelectedPhotos}
              onVisiblePhotosChange={setVisiblePhotoPaths}
            />
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-50 rounded-full mb-6">
              <Search className="w-12 h-12 text-gray-300" />
            </div>
            <p className="text-gray-500 text-lg">开始搜索</p>
            <p className="text-gray-400 mt-2">输入姓名或学号，找到你的照片</p>
          </div>
        )}
      </div>

      {/* Toast 通知 */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
        {showLimitAlert && (
          <Alert variant="destructive">
            <AlertCircleIcon className="h-4 w-4" />
              <AlertTitle>超出下载限制</AlertTitle>
              <AlertDescription>
                一次最多只能下载 {MAX_DOWNLOAD} 张照片，当前已选中 {selectedPhotos.size} 张。
                请减少选择数量后重试。
              </AlertDescription>
          </Alert>
        )}
        {showSuccessAlert && (
          <Alert>
            <CheckCircle2Icon className="h-4 w-4" />
              <AlertTitle>下载完成</AlertTitle>
              <AlertDescription>
                成功下载 {downloadCount} 张照片。
              </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}