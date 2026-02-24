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
  id: string;
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  staffLevel?: string;
  permissions: UserPermissions;
  isActive: boolean;
  isVisible: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  phone?: string;
  urlAvatar?: string;
  avatar?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}
