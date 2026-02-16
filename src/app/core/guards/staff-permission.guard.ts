import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth/authservice';

@Injectable({ providedIn: 'root' })
export class StaffPermissionGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  async canActivate(route: ActivatedRouteSnapshot, _state: RouterStateSnapshot): Promise<boolean | UrlTree> {
    const user = await this.auth.resolveCurrentUser();
    if (!user) return this.router.createUrlTree(['/login']);
    if (user.role === 'admin') return true;
    if (user.role !== 'staff') return this.router.createUrlTree(['/access-denied']);

    const required = String(route.data?.['permission'] ?? '').trim();
    if (!required) return true;

    const hasPermission = user.permissions?.[required] === true;
    return hasPermission ? true : this.router.createUrlTree(['/access-denied']);
  }
}
