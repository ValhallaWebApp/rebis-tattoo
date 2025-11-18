import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getDatabase, provideDatabase } from '@angular/fire/database';
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }),    provideHttpClient(),
 provideRouter(routes, withHashLocation()), provideAnimationsAsync(), provideFirebaseApp(() => initializeApp({"projectId":"rebis-tattoo-55816","appId":"1:70352364616:web:24a6df01d24f6b4947647d","databaseURL":"https://rebis-tattoo-55816-default-rtdb.europe-west1.firebasedatabase.app","storageBucket":"rebis-tattoo-55816.firebasestorage.app","apiKey":"AIzaSyDFOFTJ9p60YeoVdLGo8ZfuaOOaUpgAP5E","authDomain":"rebis-tattoo-55816.firebaseapp.com","messagingSenderId":"70352364616","measurementId":"G-1HW9SPJ1CN"})), provideAuth(() => getAuth()), provideFirestore(() => getFirestore()), provideDatabase(() => getDatabase())]
};
