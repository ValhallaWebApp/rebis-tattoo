export type UserRole = 'admin' | 'client' | 'staff' | 'public' | 'guest';

export interface UserPermissions {
  canManageRoles?: boolean;
  canManageBookings?: boolean;
  canManageProjects?: boolean;
  canManageSessions?: boolean;
  canReassignProjectArtist?: boolean;
  canReassignProjectClient?: boolean;
  canViewFinancials?: boolean;
  canManageMessages?: boolean;
  canManageServices?: boolean;
  canManageBonus?: boolean;
  canViewAnalytics?: boolean;
  canViewAuditLogs?: boolean;
  [key: string]: boolean | undefined;
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
