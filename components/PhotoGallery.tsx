'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import lightGallery from 'lightgallery';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgZoom from 'lightgallery/plugins/zoom';
import lgFullscreen from 'lightgallery/plugins/fullscreen';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from '@/components/ui/spinner';
import 'lightgallery/css/lightgallery.css';
import 'lightgallery/css/lg-thumbnail.css';
import 'lightgallery/css/lg-zoom.css';
import 'lightgallery/css/lg-fullscreen.css';

interface Photo {
  name: string;
  path: string;
  shotDate?: string;
}

interface PhotoGalleryProps {
  photos: Photo[];
  selectionMode?: boolean;
  selectedPhotos?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  onVisiblePhotosChange?: (paths: string[]) => void;
}

interface GroupedPhotos {
  [key: string]: Photo[];
}

const BATCH_SIZE = 30;

export default function PhotoGallery({ photos, selectionMode = false, selectedPhotos = new Set(), onSelectionChange, onVisiblePhotosChange }: PhotoGalleryProps) {
  const galleryRefs = React.useRef<{ [key: string]: HTMLDivElement | null }>({});
  const lgInstances = React.useRef<{ [key: string]: any }>({});
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [groupedPhotos, setGroupedPhotos] = useState<GroupedPhotos>({});
  const [dates, setDates] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  // 分组照片按照拍摄日期
  useEffect(() => {
    const grouped: GroupedPhotos = { all: [] };
    const datesSet = new Set<string>();

    for (const photo of photos) {
      grouped.all.push(photo);
      if (photo.shotDate) {
        if (!grouped[photo.shotDate]) {
          grouped[photo.shotDate] = [];
        }
        grouped[photo.shotDate].push(photo);
        datesSet.add(photo.shotDate);
      }
    }

    const sortedDates = Array.from(datesSet).sort().reverse();
    setGroupedPhotos(grouped);

    // 如果所有照片都是同一天，就不显示日期分类
    if (sortedDates.length <= 1) {
      setDates([]);
    } else {
      setDates(['all', ...sortedDates]);
    }
  }, [photos]);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [selectedDate, photos]);

  const loadMore = useCallback(() => {
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(prev => {
        const currentPhotos = groupedPhotos[selectedDate] || [];
        const next = Math.min(prev + BATCH_SIZE, currentPhotos.length);
        return next;
      });
      setLoadingMore(false);
    }, 300);
  }, [selectedDate, groupedPhotos]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          const currentPhotos = groupedPhotos[selectedDate] || [];
          if (visibleCount < currentPhotos.length) {
            loadMore();
          }
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, loadingMore, loadMore, groupedPhotos, selectedDate]);

  // 初始化 lightGallery（非选中模式）
  useEffect(() => {
    if (selectionMode) return;

    const hasDateFilter = dates.length > 0;
    const galleryKey = hasDateFilter ? selectedDate : 'all';
    const container = galleryRefs.current[galleryKey];

    if (!container || groupedPhotos[galleryKey]?.length === 0) return;

    // 销毁之前的实例
    Object.values(lgInstances.current).forEach(instance => {
      if (instance) {
        try {
          if (typeof instance.destroy === 'function') {
            instance.destroy();
          }
        } catch (error) {
          console.warn('Error destroying lightGallery:', error);
        }
      }
    });
    lgInstances.current = {};

    const timer = setTimeout(() => {
      try {
        if (container && container.children.length > 0) {
          // 屏蔽 lightGallery 的 license key 警告
          const originalWarn = console.warn;
          console.warn = (...args: unknown[]) => {
            if (typeof args[0] === 'string' && args[0].includes('license key')) return;
            originalWarn.apply(console, args);
          };

          lgInstances.current[galleryKey] = lightGallery(container, {
            plugins: [lgThumbnail, lgZoom, lgFullscreen],
            speed: 500,
            download: true,
            showZoomInOutIcons: true,
            thumbnail: true,
            zoomFromOrigin: false,
            // animateThumb: false,
            mobileSettings: {
              showCloseIcon: true,
              showZoomInOutIcons: true,
            },
          });

          console.warn = originalWarn;
        }
      } catch (error) {
        console.error('Error initializing lightGallery:', error);
      }
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [selectedDate, groupedPhotos, dates.length, selectionMode]);

  const formatDate = (dateStr: string) => {
    if (dateStr === 'all') return '全部';
    const date = new Date(dateStr + 'T00:00:00');
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}.${day}`;
  };

  const currentPhotos = groupedPhotos[selectedDate] || [];

  useEffect(() => {
    onVisiblePhotosChange?.(currentPhotos.map(p => p.path));
  }, [currentPhotos, onVisiblePhotosChange]);

  const toggleSelection = (photoPath: string) => {
    const next = new Set(selectedPhotos);
    if (next.has(photoPath)) {
      next.delete(photoPath);
    } else {
      next.add(photoPath);
    }
    onSelectionChange?.(next);
  };

  return (
    <div>
      {/* 筛选区域 */}
      {dates.length > 0 && (
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            {/* 日期筛选 - Tabs */}
            <Tabs value={selectedDate} onValueChange={setSelectedDate} className="flex-1">
              <TabsList variant="line" className="flex flex-wrap justify-start border-b-primary">
                {dates.map(date => (
                  <TabsTrigger 
                    key={date} 
                    value={date} 
                    className="flex-shrink-0 data-[state=active]:text-primary data-[state=active]:border-b-primary"
                  >
                    {formatDate(date)} {date !== 'all' && `(${groupedPhotos[date]?.length || 0})`}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* 排序 Select */}
            <div className="flex-shrink-0">
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
          </div>
        </div>
      )}

      {/* 照片网格 */}
      <div
        ref={el => {
          if (el && !selectionMode) galleryRefs.current[selectedDate] = el;
        }}
        className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
      >
        {[...currentPhotos].sort((a, b) => {
          const nameA = a.name.toLowerCase();
          const nameB = b.name.toLowerCase();
          return sortOrder === 'desc' ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
        }).slice(0, visibleCount).map((photo) => {
          const isSelected = selectedPhotos.has(photo.path);

          if (selectionMode) {
            return (
              <div
                key={photo.path}
                onClick={() => toggleSelection(photo.path)}
                className="relative overflow-hidden rounded-lg cursor-pointer select-none"
              >
                <div className="relative w-full aspect-square overflow-hidden rounded-lg bg-gray-100">
                  <img
                    src={photo.path}
                    alt={photo.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* 选中圆圈 */}
                <div
                  className={`absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-primary border-primary text-white'
                      : 'border-white bg-black/30'
                  }`}
                >
                  {isSelected && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            );
          }

          return (
            <a
              key={photo.path}
              href={photo.path}
              data-lg-size="1280-720"
              className="group relative overflow-hidden rounded-lg"
            >
              <div className="relative w-full aspect-square overflow-hidden rounded-lg bg-gray-100">
                <img
                  src={photo.path}
                  alt={photo.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>
            </a>
          );
        })}
      </div>

      <div ref={sentinelRef} className="flex justify-center py-8">
        {loadingMore && <Spinner className="w-6 h-6" />}
        {!loadingMore && visibleCount < currentPhotos.length && (
          <span className="text-sm text-gray-400">{currentPhotos.length - visibleCount} 张更多照片</span>
        )}
      </div>
    </div>
  );
}