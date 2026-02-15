# 06 - Librerie e Configurazioni

## Dipendenze framework
- `@angular/*` 18.x
- `rxjs`
- `zone.js`

## UI e visual
- `@angular/material`, `@angular/cdk`
- `@swimlane/ngx-charts`
- `@fullcalendar/*`
- `d3`
- `three`

## Integrazioni
- `@angular/fire`
- `@stripe/stripe-js`
- `xlsx`

## Script npm principali
- `start`: dev server
- `start:stage`: dev server config stage
- `build`: build production
- `build:stage`: build stage
- `test`: Karma/Jasmine
- `db:*`: export/import RTDB script powershell
- `firebase:deploy`: deploy functions + database rules

## Config Angular
- `angular.json`:
  - build configurations `development`, `stage`, `production`
  - file replacement env (`environment*.ts`)
- `app.config.ts`:
  - router hash strategy
  - locale `it-IT`
  - provider Firebase app/auth/firestore/database

## Runtime config
- file usato in runtime: `public/app-config.js`
- template: `public/app-config.template.js`
- validazione bootstrap: `environment-validation.ts`

## Nota ambiente Windows
Possibile errore `spawn EPERM` su build Angular/esbuild in alcuni contesti locali.
