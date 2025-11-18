import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth/authservice';

export const AuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.userSig();

  // 🔹 Non loggato → redirect login
  if (!user) {
    return router.createUrlTree(['/login']);
  }

  // 🔹 Loggato ma ruolo diverso da 'client' → redirect home
  if (user.role !== 'client' && user.role !== 'admin') {
    return router.createUrlTree(['/']);
  }

  // ✅ Ok, accesso consentito
  return true;
};
