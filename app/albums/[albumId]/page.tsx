'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PhotoGallery from '@/components/PhotoGallery';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, MapPin, Eye, User, ExternalLink, Download, Calendar, AlertCircleIcon, CheckCircle2Icon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AlbumInfo {
  id: string;
  title: string;
  description: string;
  location: string;
  shootDate: string;
  endDate: string;
  viewCount: number;
  liveUrl?: string;
  coverImage?: string;
}

interface Photo {
  name: string;
  path: string;
  shotDate?: string;
}

export default function AlbumDetailPage() {
  const params = useParams();
  const router = useRouter();
  const albumId = params.albumId as string;

  const [albumInfo, setAlbumInfo] = useState<AlbumInfo | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [visiblePhotoPaths, setVisiblePhotoPaths] = useState<string[]>([]);
  const [showLimitAlert, setShowLimitAlert] = useState(false);
  const [downloadCount, setDownloadCount] = useState(0);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);

  const MAX_DOWNLOAD = 100;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [infoRes, photosRes] = await Promise.all([
          fetch(`/api/albums/${albumId}`),
          fetch(`/api/albums/${albumId}/photos`),
        ]);

        if (!infoRes.ok || !photosRes.ok) throw new Error('Failed to fetch data');

        const info = await infoRes.json();
        const photosData = await photosRes.json();

        setAlbumInfo(info);
        setPhotos(photosData.photos || []);
      } catch (error) {
        console.error('Error fetching album:', error);
      } finally {
        setLoading(false);
      }
    };

    if (albumId) fetchData();
  }, [albumId]);

  useEffect(() => {
    if (albumInfo) {
      document.title = `${albumInfo.title} - 广学相册`;
    }
  }, [albumInfo]);

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

    const photos = Array.from(selectedPhotos);
    for (let i = 0; i < photos.length; i++) {
      const photoPath = photos[i];
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

    const count = photos.length;
    setDownloadCount(count);
    setShowSuccessAlert(true);
    setSelectionMode(false);
    setSelectedPhotos(new Set());
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Skeleton className="w-32 h-10 mb-6" />
          <Skeleton className="w-full h-12 mb-4" />
          <Skeleton className="w-full h-6 mb-8" />
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="w-full aspect-square rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!albumInfo) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg mb-4">相册不存在</p>
          <Button onClick={() => router.push('/albums')}>返回相册列表</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 返回按钮 */}
        <Button
          variant="ghost"
          onClick={() => router.push('/albums')}
          className="mb-6 flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          返回首页
        </Button>

        {/* 相册信息 */}
        <div className="mb-8 flex flex-col lg:flex-row gap-8 items-start">
          {/* 左侧封面图 */}
          {albumInfo.coverImage && (
            <div className="lg:w-1/3 rounded-lg overflow-hidden shadow-lg flex-shrink-0">
              <img
                src={`/info/${albumId}/${albumInfo.coverImage}`}
                alt={`${albumInfo.title} 封面`}
                className="w-full h-auto object-cover"
              />
            </div>
          )}

          {/* 右侧信息 */}
          <div className="flex-1 lg:w-2/3">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{albumInfo.title}</h1>
            <p className="text-gray-700 text-lg mb-6">{albumInfo.description}</p>

            <div className="flex flex-wrap gap-4 text-gray-600 mb-6">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                <span>{albumInfo.viewCount.toLocaleString()} 人次浏览</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                <span>{albumInfo.location}</span>
              </div>
              {albumInfo.shootDate && (
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span>
                    {formatDate(albumInfo.shootDate)}
                    {albumInfo.endDate && albumInfo.endDate !== albumInfo.shootDate &&
                      ` - ${formatDate(albumInfo.endDate)}`}
                  </span>
                </div>
              )}
              <div className="text-gray-500">
                共 {photos.length} 张照片
              </div>
            </div>

            {/* 功能按钮 */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => router.push(`/albums/${albumId}/find`)}>
                <User className="w-4 h-4 mr-2" />
                找自己
              </Button>
              {albumInfo.liveUrl && (
                <Button variant="outline" onClick={() => window.open(albumInfo.liveUrl, '_blank')}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  原直播
                </Button>
              )}
              {selectionMode ? (
                <>
                  <Button onClick={handleDownload} disabled={selectedPhotos.size === 0}>
                    <Download className="w-4 h-4 mr-2" />
                    下载选中 ({selectedPhotos.size})
                  </Button>
                  <Button variant="ghost" onClick={() => {
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
                </>
              ) : (
                <Button variant="outline" onClick={() => setSelectionMode(true)}>
                  <Download className="w-4 h-4 mr-2" />
                  批量下载
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 照片库 */}
        {photos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">还没有照片</p>
          </div>
        ) : (
          <PhotoGallery
            photos={photos}
            selectionMode={selectionMode}
            selectedPhotos={selectedPhotos}
            onSelectionChange={setSelectedPhotos}
            onVisiblePhotosChange={setVisiblePhotoPaths}
          />
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
            <CheckCircle2Icon />
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