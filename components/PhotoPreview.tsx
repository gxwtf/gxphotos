'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';

interface Photo {
  name: string;
  path: string;
  shotDate?: string;
}

interface PhotoPreviewProps {
  photos: Photo[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function PhotoPreview({
  photos,
  initialIndex,
  isOpen,
  onClose,
}: PhotoPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [thumbApi, setThumbApi] = useState<CarouselApi>();
  const [mounted, setMounted] = useState(false);
  const thumbRef = useRef<HTMLDivElement>(null);
  const currentIndexRef = useRef(currentIndex);
  const photosLengthRef = useRef(photos.length);

  currentIndexRef.current = currentIndex;
  photosLengthRef.current = photos.length;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndexRef.current > 0) {
        setCurrentIndex((prev) => prev - 1);
      } else if (e.key === 'ArrowRight' && currentIndexRef.current < photosLengthRef.current - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (thumbApi) {
      thumbApi.scrollTo(currentIndex);
    }
  }, [currentIndex, thumbApi]);

  useEffect(() => {
    const el = thumbRef.current;
    if (!el || !thumbApi) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaX || e.deltaY;
      if (delta > 0) {
        thumbApi.scrollNext();
      } else if (delta < 0) {
        thumbApi.scrollPrev();
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [thumbApi]);

  const handleDownload = useCallback(async () => {
    const photo = photos[currentIndex];
    if (!photo) return;

    const res = await fetch(photo.path);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = photo.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [photos, currentIndex]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(photos.length - 1, prev + 1));
  }, [photos.length]);

  if (!isOpen || !mounted) return null;

  const currentPhoto = photos[currentIndex];

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
        <span className="text-sm font-medium tabular-nums">
          {currentIndex + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDownload}
            className="text-white hover:bg-white/20 rounded-full"
            title="下载"
          >
            <Download className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full"
            title="关闭"
          >
            <X className="size-5" />
          </Button>
        </div>
      </div>

      {/* Main image area */}
      <div className="flex-1 flex items-center justify-center min-h-0 px-4">
        <Button
          variant="ghost"
          size="icon-lg"
          onClick={goToPrev}
          disabled={currentIndex === 0}
          className="shrink-0 text-white/80 hover:text-white hover:bg-white/10 rounded-full disabled:opacity-30"
        >
          <ChevronLeft className="size-8" />
        </Button>

        <div className="relative w-full h-full max-w-5xl max-h-[75vh]">
          {currentPhoto && (
            <Image
              src={currentPhoto.path}
              alt={currentPhoto.name}
              fill
              className="object-contain"
              sizes="(max-width: 1024px) 100vw, 80vw"
              priority
              unoptimized
            />
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-lg"
          onClick={goToNext}
          disabled={currentIndex === photos.length - 1}
          className="shrink-0 text-white/80 hover:text-white hover:bg-white/10 rounded-full disabled:opacity-30"
        >
          <ChevronRight className="size-8" />
        </Button>
      </div>

      {/* Thumbnail carousel */}
      <div ref={thumbRef} className="shrink-0 py-4 px-16">
        <Carousel
          setApi={setThumbApi}
          opts={{
            align: 'center',
            containScroll: 'keepSnaps',
            dragFree: true,
            watchDrag: (_, evt) => evt.type !== 'mousedown',
          }}
          className="w-full max-w-4xl mx-auto"
        >
          <CarouselContent className="-ml-2">
            {photos.map((photo, index) => (
              <CarouselItem
                key={photo.path}
                className="pl-2 basis-[14.28%] md:basis-[12.5%] lg:basis-[10%]"
              >
                <button
                  onClick={() => setCurrentIndex(index)}
                  className={`relative w-full aspect-square overflow-hidden rounded-md transition-all cursor-pointer ${
                    index === currentIndex
                      ? 'border-2 border-white opacity-100'
                      : 'opacity-50 hover:opacity-80'
                  }`}
                >
                  <Image
                    src={photo.path}
                    alt={photo.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 14vw, 10vw"
                  />
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </div>,
    document.body
  );
}