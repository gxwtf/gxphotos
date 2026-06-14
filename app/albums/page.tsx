'use client';

import { useEffect, useState } from 'react';
import AlbumCard from '@/components/AlbumCard';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 头部 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">广学照片直播</h1>
          <p className="text-gray-500 text-lg">记录每一个精彩瞬间</p>
        </div>

        {/* 排序控制 */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-gray-500">
            共 {albums.length} 个相册
          </p>
          <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="排序">
                {sortOrder === 'desc' ? '从晚到早' : '从早到晚'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">从晚到早</SelectItem>
              <SelectItem value="asc">从早到晚</SelectItem>
            </SelectContent>
          </Select>
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