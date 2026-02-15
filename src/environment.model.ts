export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface AppEnvironment {
  production: boolean;
  environmentName: 'development' | 'stage' | 'production';
  paymentApiBaseUrl: string;
  stripePublishableKey: string;
  firebaseConfig: FirebaseWebConfig;
}
