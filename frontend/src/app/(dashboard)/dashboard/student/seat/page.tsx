'use client';

import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StudentSeatDetails } from '@/components/students/student-seat-details';
import { studentApi } from '@/modules/students/student.service';

export default function MySeatPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['student', 'me', 'seat'],
    queryFn: () => studentApi.mySeat(),
  });

  if (isLoading) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (isError) return <p className="text-sm text-muted-foreground">Unable to load seat details.</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My seat</CardTitle>
      </CardHeader>
      <CardContent>
        {data ? (
          <StudentSeatDetails seat={data} />
        ) : (
          <p className="text-sm text-muted-foreground">No seat assigned to your profile yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
