export const STUDENT_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export type StudentStatus = (typeof STUDENT_STATUS)[keyof typeof STUDENT_STATUS];

export const STUDENT_GENDER = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
  UNSPECIFIED: 'UNSPECIFIED',
} as const;

export type StudentGender = (typeof STUDENT_GENDER)[keyof typeof STUDENT_GENDER];

export const STUDENT_SORT_FIELDS = [
  'createdAt',
  'admissionDate',
  'membershipEndDate',
  'fullName',
  'studentId',
  'status',
  'branchId',
] as const;

export type StudentSortField = (typeof STUDENT_SORT_FIELDS)[number];
