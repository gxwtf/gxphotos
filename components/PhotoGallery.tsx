'use client';

import React, { useEffect, useState } from 'react';
import lightGallery from 'lightgallery';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgZoom from 'lightgallery/plugins/zoom';
import lgFullscreen from 'lightgallery/plugins/fullscreen';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
}

interface GroupedPhotos {
  [key: string]: Photo[];
}

export default function PhotoGallery({ photos }: PhotoGalleryProps) {
  const galleryRefs = React.useRef<{ [key: string]: HTMLDivElement | null }>({});
  const lgInstances = React.useRef<{ [key: string]: any }>({});
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [groupedPhotos, setGroupedPhotos] = useState<GroupedPhotos>({});
  const [dates, setDates] = useState<string[]>([]);

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

  // 初始化 lightGallery
  useEffect(() => {
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
          lgInstances.current[galleryKey] = lightGallery(container, {
            plugins: [lgThumbnail, lgZoom, lgFullscreen],
            speed: 500,
            download: false,
            showZoomInOutIcons: true,
            thumbnail: true,
            zoomFromOrigin: false,
            // animateThumb: false,
            mobileSettings: {
              showCloseIcon: true,
              showZoomInOutIcons: true,
            },
          });
        }
      } catch (error) {
        console.error('Error initializing lightGallery:', error);
      }
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [selectedDate, groupedPhotos, dates.length]);

  const formatDate = (dateStr: string) => {
    if (dateStr === 'all') return '全部';
    const date = new Date(dateStr + 'T00:00:00');
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}.${day}`;
  };

  const currentPhotos = groupedPhotos[selectedDate] || [];

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
          if (el) galleryRefs.current[selectedDate] = el;
        }}
        className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
      >
        {[...currentPhotos].sort((a, b) => {
          const nameA = a.name.toLowerCase();
          const nameB = b.name.toLowerCase();
          return sortOrder === 'desc' ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
        }).map((photo) => (
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
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}