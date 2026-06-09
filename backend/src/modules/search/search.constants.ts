export const SEARCH_RESULT_KINDS = [
  'library',
  'branch',
  'user',
  'student',
  'seat',
  'invoice',
  'payment',
  'demo_request',
  'notification',
  'attendance',
] as const;

export type SearchResultKind = (typeof SEARCH_RESULT_KINDS)[number];
