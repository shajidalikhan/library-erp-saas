'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { ROUTES, studentDetailRoute } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/lib/api-error';
import { libraryApi } from '@/modules/library/library.service';
import { StudentForm } from '@/modules/students/components/student-form';
import { seatQueryKeys } from '@/modules/seats/seat-query-keys';
import { studentApi } from '@/modules/students/student.service';
import { studentQueryKeys } from '@/modules/students/student-query-keys';

export default function EditStudentPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const libraryId = useAuthStore((s) => s.user?.libraryId);

  const { data: student, isLoading, error } = useQuery({
    queryKey: studentQueryKeys.detail(studentId),
    queryFn: () => studentApi.get(studentId),
    enabled: Boolean(studentId),
  });

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['student-edit-branches', libraryId ?? student?.libraryId],
    queryFn: () => libraryApi.listBranches((libraryId ?? student?.libraryId)!, { limit: 100 }),
    enabled: Boolean(libraryId ?? student?.libraryId) && can(PERMISSIONS.BRANCH_READ),
  });

  if (!can(PERMISSIONS.STUDENT_UPDATE)) {
    return <EmptyState title="No access" description="You cannot edit students." />;
  }

  if (error) {
    return (
      <EmptyState title="Error" description={error instanceof ApiError ? error.message : 'Failed to load'} />
    );
  }

  if (isLoading || !student || branchesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/2 max-w-md" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const branches =
    branchesData?.items.map((b) => ({ _id: b._id, branchName: b.branchName, branchCode: b.branchCode })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${student.fullName}`}
        description="Update profile, membership, and operational notes."
        actions={
          <Button variant="outline" asChild>
            <Link href={studentDetailRoute(studentId)}>Cancel</Link>
          </Button>
        }
      />
      <StudentForm
        mode="edit"
        initial={student}
        branches={branches}
        canAssignSeat={can(PERMISSIONS.STUDENT_ASSIGN_SEAT)}
        onSubmit={async (payload) => {
          try {
            await studentApi.update(studentId, payload);
            toast.success('Student updated');
            await queryClient.invalidateQueries({ queryKey: studentQueryKeys.detail(studentId) });
            await queryClient.invalidateQueries({ queryKey: ['students'] });
            await queryClient.invalidateQueries({ queryKey: seatQueryKeys.all });
            await queryClient.invalidateQueries({ queryKey: ['seat-grid'] });
            await queryClient.invalidateQueries({ queryKey: ['seat-grid-options'] });
            router.push(studentDetailRoute(studentId));
          } catch (e) {
            if (e instanceof ApiError) toast.error(e.message);
            else toast.error('Save failed');
            throw e;
          }
        }}
      />
      <p className="text-center text-sm text-muted-foreground">
        <Link href={ROUTES.STUDENTS} className="hover:text-foreground">
          Back to students
        </Link>
      </p>
    </div>
  );
}
