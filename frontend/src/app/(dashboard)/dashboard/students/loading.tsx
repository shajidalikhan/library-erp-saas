import { Skeleton } from '@/components/ui/skeleton';

export default function StudentsLoading() {
  return (
    <div className="space-y-6 p-1">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
