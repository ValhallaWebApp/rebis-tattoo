import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth/authservice';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    const user = this.auth.userSig();

    // non loggato → vai al login e memorizza target
    if (!user) {
      localStorage.setItem('pre-log', '/admin');
      return this.router.createUrlTree(['/login']);
    }

    // loggato ma non admin → access denied (o dove preferisci)
    if (user.role !== 'admin') {
      return this.router.createUrlTree(['/access-denied']);
    }

    return true;
  }
}
