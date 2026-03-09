import { AppEnvironment } from './environment.model';

// Copy this file to environment.local.ts (or CI-generated files) and fill values.
export const environment: AppEnvironment = {
  production: false,
  environmentName: 'development',
  paymentApiBaseUrl: 'http://localhost:3000/api/payments',
  firebaseConfig: {
    apiKey: 'replace-me',
    authDomain: 'replace-me',
    databaseURL: 'https://replace-me',
    projectId: 'replace-me',
    storageBucket: 'replace-me',
    messagingSenderId: 'replace-me',
    appId: 'replace-me',
    measurementId: 'replace-me'
  },
  stripePublishableKey: 'pk_test_replace_me'
};
