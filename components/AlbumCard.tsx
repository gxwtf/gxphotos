import React from 'react';
import Link from 'next/link';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Calendar } from 'lucide-react';

interface Album {
    id: string;
    title: string;
    description: string;
    location: string;
    shootDate: string;
    endDate: string;
    coverImage?: string;
}

interface AlbumCardProps {
    album: Album;
    thumbnailUrl?: string;
}

export default function AlbumCard({ album, thumbnailUrl }: AlbumCardProps) {
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const dateDisplay = formatDate(album.shootDate)

    return (
        <Link href={`/albums/${album.id}`} className="block group">
            <Card className="relative mx-auto w-full pt-0 overflow-hidden cursor-pointer">
                <div className="relative aspect-video overflow-hidden">
                    {album.coverImage ? (
                        <img
                            src={`/info/${album.id}/${album.coverImage}`}
                            alt={album.title}
                            className="relative z-20 w-full h-full object-cover"
                        />
                    ) : thumbnailUrl ? (
                        <img
                            src={thumbnailUrl}
                            alt={album.title}
                            className="relative z-20 w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                            <svg
                                className="w-16 h-16 text-white opacity-50"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                    )}
                </div>
                <CardHeader>
                    <CardTitle className="line-clamp-2">{album.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{album.description}</CardDescription>
                </CardHeader>
                <CardFooter className="pt-0">
                    <div className="w-full flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>{album.location || '未知地点'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span className="truncate max-w-[120px]">{dateDisplay}</span>
                        </div>
                    </div>
                </CardFooter>
            </Card>
        </Link>
    );
}