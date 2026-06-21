import type { Metadata, ResolvingMetadata } from 'next';
import { getAlbumInfo } from '@/lib/album';

interface Props {
    params: Promise<{ albumId: string }>;
}

export async function generateMetadata(
  props: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { albumId } = await props.params;
  const album = getAlbumInfo(albumId);
  
  if (album) {
    return {
      title: `${album.title} - 广学相册`,
      description: album.description,
    };
  }
  
  return {
    title: `相册 - 广学相册`,
  };
}

export default function AlbumLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
