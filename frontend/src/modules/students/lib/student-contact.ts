import type { Student } from '../types';

/** Single emergency contact phone used on forms, profile, and ID card. */
export function resolveEmergencyContactPhone(student: {
  emergencyContactPhone?: string | null;
  guardianPhone?: string | null;
}): string {
  const phone = student.emergencyContactPhone?.trim();
  if (phone) return phone;
  return student.guardianPhone?.trim() ?? '';
}
