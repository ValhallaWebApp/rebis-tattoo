import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import { environment } from './environment';
import { validateEnvironmentOrThrow } from './app/core/config/environment-validation';

registerLocaleData(localeIt);
validateEnvironmentOrThrow(environment);

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
