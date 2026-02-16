import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth/authservice';

@Injectable({ providedIn: 'root' })
export class RoleManagementGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  async canActivate(_route: ActivatedRouteSnapshot, _state: RouterStateSnapshot): Promise<boolean | UrlTree> {
    const user = await this.auth.resolveCurrentUser();
    if (!user) return this.router.createUrlTree(['/login']);
    if (!this.auth.canManageRoles(user)) return this.router.createUrlTree(['/access-denied']);
    return true;
  }
}

