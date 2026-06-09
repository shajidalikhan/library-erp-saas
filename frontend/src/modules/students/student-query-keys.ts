import type { StudentListParams } from './student.service';

export const studentQueryKeys = {
  list: (params: StudentListParams) => ['students', params] as const,
  detail: (id: string) => ['student', id] as const,
  summary: (id: string) => ['student', id, 'summary'] as const,
};
