export const attendanceQueryKeys = {
  all: ['attendance'] as const,
  board: (params: unknown) => [...attendanceQueryKeys.all, 'board', params] as const,
  daily: (params: unknown) => [...attendanceQueryKeys.all, 'daily', params] as const,
  active: (params: unknown) => [...attendanceQueryKeys.all, 'active', params] as const,
  summary: (params: unknown) => [...attendanceQueryKeys.all, 'summary', params] as const,
  studentHistory: (studentId: string, params: unknown) =>
    [...attendanceQueryKeys.all, 'student-history', studentId, params] as const,
};
