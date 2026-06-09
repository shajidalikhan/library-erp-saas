import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Libraries',
  description: 'Manage tenant libraries and subscription metadata.',
};

export default function LibrariesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
