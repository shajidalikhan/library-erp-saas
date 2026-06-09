import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Students',
  description: 'Admissions, profiles, and membership for your library.',
};

export default function StudentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
