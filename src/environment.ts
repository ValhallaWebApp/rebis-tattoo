import { AppEnvironment } from './environment.model';
import { withRuntimeConfig } from './runtime-config';

const baseEnvironment: AppEnvironment = {
  production: false,
  environmentName: 'development',
  paymentApiBaseUrl: 'http://localhost:3000/api/payments',
  firebaseConfig: {
    // Fill these values in env files or provide them via runtime __APP_CONFIG__.firebaseConfig
    apiKey: '',
    authDomain: '',
    databaseURL: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: ''
  },
  stripePublishableKey: ''
};

export const environment: AppEnvironment = withRuntimeConfig(baseEnvironment);
