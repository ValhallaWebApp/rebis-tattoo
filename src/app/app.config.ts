import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getDatabase, provideDatabase } from '@angular/fire/database';

import {
  provideNativeDateAdapter,
  MAT_DATE_LOCALE,
  MAT_DATE_FORMATS,
  MAT_NATIVE_DATE_FORMATS,
} from '@angular/material/core';
import { environment } from '../environment';
import { authHttpInterceptor } from './core/interceptors/auth-http.interceptor';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // 🔧 Performance
    provideZoneChangeDetection({ eventCoalescing: true }),

    // 🌐 HTTP
    provideHttpClient(withInterceptors([authHttpInterceptor])),

    // 🌍 Router
    provideRouter(routes, withHashLocation()),

    // 🎞️ Animazioni
    provideAnimationsAsync(),

    // 🇮🇹 Locale globale Angular
    { provide: LOCALE_ID, useValue: 'it-IT' },

    // 📅 Angular Material – DATE (FONDAMENTALE)
    provideNativeDateAdapter(),
    { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
    { provide: MAT_DATE_LOCALE, useValue: 'it-IT' },

    // 🔥 Firebase (una sola volta, corretto)
    provideFirebaseApp(() =>
      initializeApp(environment.firebaseConfig)
    ),

    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideDatabase(() => getDatabase()),
  ],
};
