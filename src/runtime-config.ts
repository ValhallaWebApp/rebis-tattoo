import { AppEnvironment, FirebaseWebConfig } from './environment.model';

export interface AppRuntimeConfig {
  paymentApiBaseUrl: string;
  stripePublishableKey: string;
  firebaseConfig: FirebaseWebConfig;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readRuntimeConfig(): Partial<AppRuntimeConfig> {
  const runtime = (globalThis as any).__APP_CONFIG__;
  if (!isObject(runtime)) return {};
  return runtime as Partial<AppRuntimeConfig>;
}

export function withRuntimeConfig(base: AppEnvironment): AppEnvironment {
  const runtime = readRuntimeConfig();
  return {
    ...base,
    paymentApiBaseUrl: runtime.paymentApiBaseUrl ?? base.paymentApiBaseUrl,
    stripePublishableKey: runtime.stripePublishableKey ?? base.stripePublishableKey,
    firebaseConfig: {
      ...base.firebaseConfig,
      ...(runtime.firebaseConfig ?? {})
    }
  };
}
