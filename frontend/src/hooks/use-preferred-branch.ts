'use client';

import { useEffect, useState } from 'react';

/**
 * Persists a branch picker value per library; auto-selects when only one branch exists.
 */
export function usePreferredBranch(
  libraryId: string,
  branches: { _id: string }[] | undefined,
  options?: { fixedBranchId?: string },
): [string, (id: string) => void] {
  const storageKey = libraryId ? `preferred-branch:${libraryId}` : '';
  const fixed = options?.fixedBranchId?.trim() ?? '';

  const [branchId, setBranchIdState] = useState(() => {
    if (fixed) return fixed;
    if (typeof window === 'undefined' || !storageKey) return '';
    return sessionStorage.getItem(storageKey) ?? '';
  });

  const setBranchId = (id: string) => {
    setBranchIdState(id);
    if (storageKey && !fixed) {
      if (id) sessionStorage.setItem(storageKey, id);
      else sessionStorage.removeItem(storageKey);
    }
  };

  useEffect(() => {
    if (fixed) {
      setBranchIdState(fixed);
      return;
    }
    if (!branches?.length) return;
    if (branchId && branches.some((b) => b._id === branchId)) return;
    if (branches.length === 1) {
      setBranchId(branches[0]._id);
      return;
    }
    if (typeof window !== 'undefined' && storageKey) {
      const stored = sessionStorage.getItem(storageKey);
      if (stored && branches.some((b) => b._id === stored)) {
        setBranchIdState(stored);
      }
    }
  }, [branches, branchId, fixed, storageKey]);

  return [fixed || branchId, setBranchId];
}
