import { AppEnvironment } from './environment.model';
import { withRuntimeConfig } from './runtime-config';

const baseEnvironment: AppEnvironment = {
  production: true,
  environmentName: 'production',
  paymentApiBaseUrl: '',
  firebaseConfig: {
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
