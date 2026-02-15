import { AppEnvironment } from '../../../environment.model';

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateEnvironmentOrThrow(environment: AppEnvironment): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!environment.paymentApiBaseUrl || !isValidHttpUrl(environment.paymentApiBaseUrl)) {
    errors.push('paymentApiBaseUrl must be a valid absolute URL.');
  }

  if (environment.environmentName !== 'development') {
    const endpoint = environment.paymentApiBaseUrl.toLowerCase();
    if (endpoint.includes('localhost') || endpoint.startsWith('http://')) {
      errors.push('Non-development builds must not target localhost or non-HTTPS payment endpoints.');
    }
  }

  if (!environment.stripePublishableKey || !environment.stripePublishableKey.startsWith('pk_')) {
    errors.push('stripePublishableKey is missing or invalid.');
  }

  if (environment.environmentName === 'production' && environment.stripePublishableKey.startsWith('pk_test_')) {
    warnings.push('Production is using a Stripe test publishable key (pk_test_).');
  }

  const firebase = environment.firebaseConfig;
  const requiredFirebaseKeys: Array<keyof AppEnvironment['firebaseConfig']> = [
    'apiKey',
    'authDomain',
    'databaseURL',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  for (const key of requiredFirebaseKeys) {
    if (!firebase[key] || String(firebase[key]).trim() === '') {
      errors.push(`firebaseConfig.${key} is required.`);
    }
  }

  if (warnings.length > 0) {
    console.warn('[env] configuration warnings:', warnings);
  }

  if (errors.length > 0) {
    throw new Error(`[env] invalid configuration: ${errors.join(' ')}`);
  }
}
