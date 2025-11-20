export type UserRole = 'admin' | 'client';

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  phoneNumber?: string;
  createdAt: string;
}
