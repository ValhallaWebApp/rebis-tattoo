export type UserRole = 'admin' | 'client' | 'staff' | 'public' | 'guest';

export interface UserPermissions {
  canManageRoles?: boolean;
}

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  permissions?: UserPermissions;
  isActive?: boolean;
  phone?: string;
  avatar?: string;
  dateOfBirth?: unknown;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}
