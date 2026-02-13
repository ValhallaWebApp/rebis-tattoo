export type UserRole = 'admin' | 'client' | 'staff' | 'public' | 'guest';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  isActive?: boolean;
  phone?: string;
  avatar?: string;
  dateOfBirth?: unknown;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}
