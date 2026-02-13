import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/authservice';

export const AuthGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = await auth.resolveCurrentUser();

  if (!user) {
    localStorage.setItem('pre-log', state.url || '/dashboard');
    return router.createUrlTree(['/login']);
  }

  if (user.role !== 'client' && user.role !== 'admin' && user.role !== 'staff') {
    return router.createUrlTree(['/']);
  }

  return true;
};
