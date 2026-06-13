'use client';

import { useEffect, useState } from 'react';
import AlbumCard from '@/components/AlbumCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface Album {
  id: string;
  title: string;
  description: string;
  location: string;
  shootDate: string;
  endDate: string;
  coverImage?: string;
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
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 头部 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">照片相册</h1>
        </div>

        {/* 排序控制 */}
        <div className="mb-6 flex items-center gap-4">
          <span className="text-gray-700 font-medium">排序方式：</span>
          <div className="flex gap-2">
            <Button
              onClick={() => setSortOrder('desc')}
              variant={sortOrder === 'desc' ? 'default' : 'outline'}
            >
              按时间倒序
            </Button>
            <Button
              onClick={() => setSortOrder('asc')}
              variant={sortOrder === 'asc' ? 'default' : 'outline'}
            >
              按时间顺序
            </Button>
          </div>
        </div>

        {/* 相册网格 */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="w-full aspect-video rounded-lg" />
                <Skeleton className="w-full h-28" />
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