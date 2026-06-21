import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '相册列表 - 广学相册',
};

export default function AlbumsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
