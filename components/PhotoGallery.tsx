'use client';

import React, { useEffect, useState } from 'react';
import lightGallery from 'lightgallery';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgZoom from 'lightgallery/plugins/zoom';
import lgFullscreen from 'lightgallery/plugins/fullscreen';
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
    return date.toLocaleDateString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
    });
  };

  const currentPhotos = groupedPhotos[selectedDate] || [];

  return (
    <div>
      {/* 日期筛选 */}
      {dates.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {dates.map(date => (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                selectedDate === date
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {formatDate(date)} {date !== 'all' && `(${groupedPhotos[date]?.length || 0})`}
            </button>
          ))}
        </div>
      )}

      {/* 照片网格 */}
      <div
        ref={el => {
          if (el) galleryRefs.current[selectedDate] = el;
        }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      >
        {currentPhotos.map((photo) => (
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
            <p className="text-xs text-gray-600 mt-2 truncate">
              {photo.name}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}