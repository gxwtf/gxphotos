import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';

interface Album {
    id: string;
    title: string;
    description: string;
    location: string;
    shootDate: string;
    endDate: string;
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
    
    const isSameDay = album.shootDate === album.endDate;
    const dateDisplay = isSameDay 
        ? formatDate(album.shootDate)
        : `${formatDate(album.shootDate)} - ${formatDate(album.endDate)}`;

    return (
        <Link href={`/albums/${album.id}`}>
            <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
                <div className="relative w-full h-48 bg-gray-200 overflow-hidden">
                    {thumbnailUrl ? (
                        <img
                            src={thumbnailUrl}
                            alt={album.title}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-200 to-blue-400 flex items-center justify-center">
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
                <CardContent>
                    <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                            <span className="text-gray-500">📍</span>
                            <span className="text-gray-700">{album.location}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-start gap-2">
                                <span className="text-gray-500">📅</span>
                                <span className="text-gray-700">{dateDisplay}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
