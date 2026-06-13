'use client';

import { useEffect, useState } from 'react';
import AlbumCard from '@/components/AlbumCard';
import { Skeleton } from '@/components/ui/skeleton';

interface Album {
  id: string;
  title: string;
  description: string;
  location: string;
  shootDate: string;
  endDate: string;
}

export default function AlbumsPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        const response = await fetch('/api/albums');
        if (!response.ok) throw new Error('Failed to fetch albums');
        const data = await response.json();
        setAlbums(data);
      } catch (error) {
        console.error('Error fetching albums:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbums();
  }, []);

  const sortedAlbums = [...albums].sort((a, b) => {
    const dateA = new Date(a.shootDate).getTime();
    const dateB = new Date(b.shootDate).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 头部 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">照片相册</h1>
          <p className="text-gray-600">浏览所有的照片和视频相册</p>
        </div>

        {/* 排序控制 */}
        <div className="mb-6 flex items-center gap-4">
          <span className="text-gray-700 font-medium">排序方式：</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSortOrder('desc')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                sortOrder === 'desc'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              按时间倒序
            </button>
            <button
              onClick={() => setSortOrder('asc')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                sortOrder === 'asc'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              按时间顺序
            </button>
          </div>
        </div>

        {/* 相册网格 */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="w-full h-48 rounded-lg" />
                <Skeleton className="w-full h-20" />
              </div>
            ))}
          </div>
        ) : albums.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">还没有相册</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedAlbums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}