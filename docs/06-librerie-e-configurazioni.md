# 06 - Librerie e Configurazioni

## Dipendenze framework
- `@angular/*` `18.2.x`
- `rxjs` `7.8.x`
- `zone.js` `0.14.x`

## UI e rendering
- `@angular/material`, `@angular/cdk`
- `@fullcalendar/*`
- `@swimlane/ngx-charts`
- `d3`, `three`

## Integrazioni esterne
- `@angular/fire`
- `@stripe/stripe-js`
- `xlsx`
- `@huggingface/transformers` + `onnxruntime-web` (chat locale)

## Build/test/tooling
- Angular CLI + build-angular
- ESLint (`eslint.config.js`)
- Storybook (`.storybook/*`)
- Karma/Jasmine unit test
- Playwright UI visual test

## Script npm principali
- `npm run start`
- `npm run start:stage`
- `npm run build`
- `npm run build:stage`
- `npm run lint`
- `npm run test`
- `npm run test:ui`
- `npm run storybook`
- `npm run build-storybook`
- `npm run db:generate:mock`
- `npm run db:export`
- `npm run db:import:*`

## Config Angular (`angular.json`)
Configurazioni build:
- `development`
- `stage`
- `production`

File replacement:
- `src/environment.ts` -> `src/environment.stage.ts|src/environment.prod.ts`

## Config runtime
- template: `public/app-config.template.js`
- file runtime attivo: `public/app-config.js`
- merge runtime/base: `src/runtime-config.ts`
- validazione: `src/app/core/config/environment-validation.ts`

## SSR
- nessuna configurazione SSR rilevata (`@angular/ssr` assente)
