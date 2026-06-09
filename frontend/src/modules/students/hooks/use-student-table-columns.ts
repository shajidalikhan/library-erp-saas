'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'library-erp:students:column-visibility';

export type StudentColumnId =
  | 'studentId'
  | 'fullName'
  | 'branch'
  | 'status'
  | 'membershipEnd'
  | 'email'
  | 'phone'
  | 'actions';

const DEFAULTS: Record<StudentColumnId, boolean> = {
  studentId: true,
  fullName: true,
  branch: true,
  status: true,
  membershipEnd: true,
  email: false,
  phone: false,
  actions: true,
};

export function useStudentTableColumns() {
  const [visible, setVisible] = useState<Record<StudentColumnId, boolean>>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<StudentColumnId, boolean>>;
      setVisible((prev) => ({ ...prev, ...parsed }));
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((next: Record<StudentColumnId, boolean>) => {
    setVisible(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(
    (id: StudentColumnId) => {
      persist({ ...visible, [id]: !visible[id] });
    },
    [persist, visible],
  );

  const reset = useCallback(() => persist(DEFAULTS), [persist]);

  return { visible, toggle, reset };
}

/** Maps a student to a CSV-friendly row respecting visible columns (export-ready). */
export function studentToExportRow(
  student: { studentId: string; fullName: string; branchId?: string; status?: string; membershipEndDate?: string | null; email?: string; phone?: string },
  visible: Record<StudentColumnId, boolean>,
): string[] {
  const cells: string[] = [];
  if (visible.studentId) cells.push(student.studentId);
  if (visible.fullName) cells.push(student.fullName);
  if (visible.branch) cells.push(student.branchId ?? '');
  if (visible.status) cells.push(student.status ?? '');
  if (visible.membershipEnd) cells.push(student.membershipEndDate ?? '');
  if (visible.email) cells.push(student.email ?? '');
  if (visible.phone) cells.push(student.phone ?? '');
  return cells;
}
