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

  if (environment.environmentName === 'production') {
    if (environment.stripePublishableKey.startsWith('pk_test_')) {
      if (!environment.allowStripeTestKeyInProduction) {
        errors.push('Production must not use Stripe test publishable keys (pk_test_*).');
      }
    } else if (!environment.stripePublishableKey.startsWith('pk_live_')) {
      errors.push('Production must use a Stripe live publishable key (pk_live_*).');
    }
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

  if (errors.length > 0) {
    throw new Error(`[env] invalid configuration: ${errors.join(' ')}`);
  }
}
