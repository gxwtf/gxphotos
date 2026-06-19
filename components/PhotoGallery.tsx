'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { CalendarArrowDown, CalendarArrowUp } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import PhotoPreview from "@/components/PhotoPreview";

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

export default function PhotoGallery({ photos, selectionMode = false, selectedPhotos = new Set(), onSelectionChange, onVisiblePhotosChange }: PhotoGalleryProps) {
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [groupedPhotos, setGroupedPhotos] = useState<GroupedPhotos>({});
  const [dates, setDates] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

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

    if (sortedDates.length <= 1) {
      setDates([]);
    } else {
      setDates(['all', ...sortedDates]);
    }
  }, [photos]);

  const currentPhotos = groupedPhotos[selectedDate] || [];

  const sortedPhotos = [...currentPhotos].sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    return sortOrder === 'desc' ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
  });

  const formatDate = (dateStr: string) => {
    if (dateStr === 'all') return '全部';
    const date = new Date(dateStr + 'T00:00:00');
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}.${day}`;
  };

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
      {photos.length > 0 && (
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            {dates.length > 0 && (
              <Tabs value={selectedDate} onValueChange={setSelectedDate} className="flex-1">
                <TabsList variant="line" className="flex flex-wrap justify-start border-b-primary">
                  {dates.map(date => (
                    <TabsTrigger
                      key={date}
                      value={date}
                      className="flex-shrink-0 data-[state=active]:text-primary data-[state=active]:border-b-primary"
                    >
                      {formatDate(date)} {date !== 'all' && <span className="hidden md:inline">({groupedPhotos[date]?.length || 0})</span>}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}

            <div className="flex-shrink-0 ml-auto">
              {/* Desktop: Select dropdown */}
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}>
                <SelectTrigger className="w-36 hidden md:flex">
                  <SelectValue placeholder="排序">
                    {sortOrder === 'desc' ? '从晚到早' : '从早到晚'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">从晚到早</SelectItem>
                  <SelectItem value="asc">从早到晚</SelectItem>
                </SelectContent>
              </Select>
              {/* Mobile: Icon toggle */}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="md:hidden"
                title={sortOrder === 'desc' ? '从晚到早' : '从早到晚'}
              >
                {sortOrder === 'desc' ? <CalendarArrowDown className="size-5" /> : <CalendarArrowUp className="size-5" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {sortedPhotos.map((photo) => {
          const isSelected = selectedPhotos.has(photo.path);

          if (selectionMode) {
            return (
              <div
                key={photo.path}
                onClick={() => toggleSelection(photo.path)}
                className="relative overflow-hidden rounded-lg cursor-pointer select-none"
              >
                <div className="relative w-full aspect-square overflow-hidden rounded-lg bg-gray-100">
                  <Image
                    src={photo.path}
                    alt={photo.name}
                    fill
                    sizes="(max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                    className="object-cover"
                  />
                </div>
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
            <button
              key={photo.path}
              onClick={() => {
                setPreviewIndex(sortedPhotos.indexOf(photo));
                setPreviewOpen(true);
              }}
              className="group relative overflow-hidden rounded-lg w-full cursor-pointer"
            >
              <div className="relative w-full aspect-square overflow-hidden rounded-lg bg-gray-100">
                <Image
                  src={photo.path}
                  alt={photo.name}
                  fill
                  sizes="(max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>
            </button>
          );
        })}
      </div>

      <PhotoPreview
        photos={sortedPhotos}
        initialIndex={previewIndex}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}