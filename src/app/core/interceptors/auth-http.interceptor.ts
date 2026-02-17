import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { Auth, authState } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { environment } from '../../../environment';
import { from, Observable, throwError } from 'rxjs';
import { catchError, switchMap, take } from 'rxjs/operators';

function shouldAttachToken(req: HttpRequest<unknown>): boolean {
  if (req.headers.has('Authorization')) return false;

  const url = req.url;
  if (url.startsWith('/api/')) return true;
  if (url.startsWith(environment.paymentApiBaseUrl)) return true;
  if (url.startsWith('http://localhost:3001/api/')) return true;

  return false;
}

async function resolveIdToken(auth: Auth): Promise<string | null> {
  const user = auth.currentUser ?? (await new Promise((resolve) => {
    authState(auth).pipe(take(1)).subscribe(resolve);
  }));
  if (!user) return null;

  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export const authHttpInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (!shouldAttachToken(req)) {
    return next(req);
  }

  return from(resolveIdToken(auth)).pipe(
    switchMap((token) => {
      const withAuth = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;
      return next(withAuth);
    }),
    catchError((error: HttpErrorResponse) => {
      if ((error.status === 401 || error.status === 403) && auth.currentUser) {
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};

