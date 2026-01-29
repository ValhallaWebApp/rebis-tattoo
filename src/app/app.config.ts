import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

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

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // 🔧 Performance
    provideZoneChangeDetection({ eventCoalescing: true }),

    // 🌐 HTTP
    provideHttpClient(),

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
      initializeApp({
        projectId: 'rebis-tattoo-55816',
        appId: '1:70352364616:web:24a6df01d24f6b4947647d',
        databaseURL: 'https://rebis-tattoo-55816-default-rtdb.europe-west1.firebasedatabase.app',
        storageBucket: 'rebis-tattoo-55816.firebasestorage.app',
        apiKey: 'AIzaSyDFOFTJ9p60YeoVdLGo8ZfuaOOaUpgAP5E',
        authDomain: 'rebis-tattoo-55816.firebaseapp.com',
        messagingSenderId: '70352364616',
        measurementId: 'G-1HW9SPJ1CN',
      })
    ),

    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideDatabase(() => getDatabase()),
  ],
};
