import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth/authservice';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  async canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean | UrlTree> {
    const user = await this.auth.resolveCurrentUser();

    if (!user) {
      localStorage.setItem('pre-log', state.url || '/staff');
      return this.router.createUrlTree(['/login']);
    }

    if (user.role !== 'admin' && user.role !== 'staff') {
      return this.router.createUrlTree(['/access-denied']);
    }

    return true;
  }
}
