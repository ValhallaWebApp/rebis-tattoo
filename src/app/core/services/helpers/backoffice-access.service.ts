import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class BackofficeAccessService {
  private readonly auth = inject(AuthService);

  getBackofficeBase(): '/admin' | '/staff' {
    return this.auth.userSig()?.role === 'staff' ? '/staff' : '/admin';
  }

  hasStaffPermission(permissionKey: string): boolean {
    const user = this.auth.userSig();
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role !== 'staff') return false;
    return user.permissions?.[permissionKey] === true;
  }
}
