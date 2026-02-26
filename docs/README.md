# Documentazione Frontend - Rebis Tattoo

Documentazione aggiornata sul codice reale del repository `gestionale-tattuaggi`.

## Baseline tecnica (snapshot 2026-02-25)
- Angular 18.2 (app ibrida: standalone + NgModule)
- Routing hash-based (`withHashLocation()`)
- Firebase Auth + Realtime Database + Firestore (provider attivi)
- Payment backend via Cloud Functions + Stripe Elements
- Chatbot frontend con supporto Local LLM (web worker)
- Test stack: Karma/Jasmine + Playwright + Storybook

Dati di scansione utili (esclusi `node_modules/.git/.angular/functions/node_modules`):
- File applicativi: `601`
- Componenti: `96`
- Service core: `21`
- Guard: `5`
- File test `*.spec.ts`: `81`

## Indice documenti
- `01-architettura-frontend.md`
- `02-catalogo-servizi.md`
- `03-gestione-utenti-e-ruoli.md`
- `04-ui-ux-mappa.md`
- `05-interfacce-e-contratti.md`
- `06-librerie-e-configurazioni.md`
- `07-firebase-uso-e-dati.md`
- `08-stato-progetto-e-cosa-fatto.md`
- `09-hld-chat-flow-ruoli-simulazioni.md`
- `10-chatbot-frontend-ai-micro-modelli.md`
- `admin-01-overview-operativo.md`
- `admin-02-runbook-amministratore.md`
- `admin-03-checklist-go-live-e-controlli.md`
- `test-dataset-simulazione.md`
- `tasks-simulazione/01-task-rebuild-completo.md`
- `tasks-simulazione/02-task-roadmap-per-release.md`
- `tasks-simulazione/03-task-qa-udo-e-accettazione.md`

## Fonte di verita
Per dubbi, usare prima questi file di codice:
- `package.json`, `angular.json`
- `src/app/app.routes.ts`, `src/app/app.config.ts`
- `src/app/core/services/**`
- `database.rules.json`
- `functions/index.js`
