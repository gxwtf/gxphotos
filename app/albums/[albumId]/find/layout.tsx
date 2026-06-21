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
      title: `找自己 - ${album.title} - 广学相册`,
    };
  }
  
  return {
    title: `找自己 - 广学相册`,
  };
}

export default function FindLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
