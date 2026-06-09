'use client';

import { useParams } from 'next/navigation';

import { StudentDetailView } from '@/modules/students/components/student-detail-view';

export default function StudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  return <StudentDetailView studentId={params.studentId} />;
}
