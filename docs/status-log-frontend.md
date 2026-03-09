# Rebis Tattoo Frontend - Stato Lavori

Data aggiornamento: 2026-03-08 21:03:10 +01:00

## 1) Chatbot mobile
- Refactor UI/UX mobile-first applicato senza riscrivere la logica backend.
- Risolti i problemi di layout verticale: pannello a viewport controllato, area messaggi unica zona scrollabile.
- Header / quick actions / composer stabilizzati nel layout.
- Overlay nero e stile liquid-glass ottimizzati.
- Scroll to bottom rinforzato su invio/ricezione/focus/resize mobile.
- Invio con tasto Enter reso robusto (keydown cross-device).

## 2) Ruoli e visibilita chatbot
- Chatbot disabilitato per ruolo admin e staff.
- Chatbot visibile solo a utenti non admin/staff e solo se sezione client chat e visibile.

## 3) Sezioni visibili (nuova area admin)
- Nuova pagina: /admin/sections-visibility (alias: /admin/sezioni-visibili).
- Persistenza RTDB: studioProfile/admin/menuVisibility.
- Toggle per visibilita sezioni backoffice e client dashboard.
- Menu runtime filtrato in base alla visibilita (admin, staff, client dashboard).
- Dashboard admin filtrata per non mostrare sezioni disattivate.

## 4) Correzioni bug
- Fix runtime service visibilita (ordine field initializer -> crash reduce undefined).
- Build e typecheck in stato verde (warning budget preesistenti non bloccanti).

## 5) Bonifica hardcoded - Fase 1 (completata)
Aree convertite a i18n:
- App shell: notifiche/login/logout (template root).
- Menu service: etichette public/client/staff/admin da LanguageService.
- Chatbot: quick actions, flow booking, fallback, stati UI principali.
- Admin dashboard: testi sezioni/kpi/azioni/empty state/quick links.

File lingua aggiornati:
- src/app/core/data/language/it.ts
- src/app/core/data/language/en.ts

Metriche audit aggiornate:
- html_files_with_inline_text = 97
- ts_files_with_ui_hardcoded = 47

Nota: il conteggio HTML resta alto perche la metrica include anche binding dinamici e tag icon, non solo testo utente puro.

## 6) Verifica tecnica finale
- Typecheck: OK (`npx tsc -p tsconfig.app.json --noEmit`)
- Build: OK (`npm run build`)
- Warning build: budget bundle/scss gia presenti nel progetto.

## 7) Prossimi step consigliati (Fase 2)
1. Migrare snackbar/toast hardcoded nelle aree admin (project-manager, project-tracker, billing, messaging dashboard).
2. Migrare testi template hardcoded in moduli auth/admin rimanenti.
3. Pulire placeholder/componenti stub (admin-list, tattoo-avatar).
