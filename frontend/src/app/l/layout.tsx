import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Study Library',
  description: 'Book your study seat online',
};

export default function PublicLibraryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
