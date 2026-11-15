export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive?: boolean;
  emailVerifiedAt?: string | null;
  createdAt?: string;
}
export interface AdminSession {
  user: AdminUser;
}
export interface AdminPage<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
export interface AdminOption {
  id: string;
  slug?: string;
  nameEn?: string;
  nameAr?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  status?: string;
  isActive?: boolean;
  userId?: string;
}
export interface AdminOptions {
  areas: AdminOption[];
  developers: AdminOption[];
  amenities: AdminOption[];
  agents: AdminOption[];
  users: AdminOption[];
  teamMembers: AdminOption[];
  projects: AdminOption[];
}
export type SiteValues = Record<string, { en: string; ar: string }>;
export interface SiteContent {
  version: number;
  values: SiteValues;
  fields: { key: string; section: string; label: string; maxLength: number }[];
}
