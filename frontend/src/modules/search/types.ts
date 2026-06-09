export type SearchResultKind =
  | 'library'
  | 'branch'
  | 'user'
  | 'student'
  | 'seat'
  | 'invoice'
  | 'payment'
  | 'demo_request'
  | 'notification'
  | 'attendance';

export interface SearchResultItem {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle: string | null;
  hrefPath: string;
  libraryName?: string | null;
  branchName?: string | null;
}
