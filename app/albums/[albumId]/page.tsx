'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PhotoGallery from '@/components/PhotoGallery';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, MapPin, Eye, User, ExternalLink } from 'lucide-react';

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
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Skeleton className="w-32 h-10 mb-6" />
          <Skeleton className="w-full h-12 mb-4" />
          <Skeleton className="w-full h-6 mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
          返回相册
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
            </div>
          </div>
        </div>

        {/* 照片库 */}
        {photos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">还没有照片</p>
          </div>
        ) : (
          <PhotoGallery photos={photos} />
        )}
      </div>
    </div>
  );
}