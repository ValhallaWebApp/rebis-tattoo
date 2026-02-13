# TASKS - Rebis Tattoo

## Milestone e stime

- [ ] Milestone 1 - Security Hardening (2-3 gg)
- [ ] Rimozione secret hardcoded dal frontend.
- [ ] Restrizione RTDB rules su base ruolo/proprieta dato.
- [ ] Piano rotazione chiavi e segregazione env.
- [ ] Milestone 2 - Routing Integrity (1-2 gg)
- [ ] Allineamento route usate vs route dichiarate.
- [ ] Aggiunta pagine mancanti o redirect coerenti.
- [ ] Validazione completa menu/CTA/notifiche.
- [ ] Milestone 3 - Payments E2E (3-5 gg)
- [ ] Contratto API pagamenti unico.
- [ ] Endpoint backend pagamenti + webhook idempotente.
- [ ] Integrazione frontend Stripe reale senza simulazioni.
- [ ] Milestone 4 - Domain Alignment (2-4 gg)
- [ ] Unificazione stati lifecycle booking/project/session.
- [ ] Allineamento frontend, backend e schema DB.
- [ ] Milestone 5 - Docs + Test + CI (2-3 gg)
- [ ] Completamento documentazione operativa/sicurezza/API.
- [ ] Test minimi obbligatori e run automatizzato.

## P0 - Bloccanti sicurezza e stabilita

- [x] Rimuovere la chiave OpenAI hardcoded dal frontend in `src/app/core/services/chatBot/chat-bot.service.ts`.
- [ ] Spostare le chiamate OpenAI su backend (proxy server-side) e usare variabili ambiente.
- [ ] Ruotare/revocare la chiave OpenAI esposta e sostituirla in ambiente sicuro.
- [x] Restringere le regole RTDB globali in `database.rules.json` (evitare `.read/.write` globali su `auth != null`).
- [ ] Definire policy per collezioni critiche: bookings, sessions, invoices, users, auditLogs, bonus, staff.

## P1 - Routing rotto e navigazione incoerente

- [x] Aggiungere route mancanti o correggere i link a route esistenti:
- [x] Gestire `access-denied` (usata da `AdminGuard`) in `src/app/app.routes.ts`.
- [x] Sistemare `'/auth/login'` e `'/auth/register'` in `home-contact.component.ts` (oggi esiste solo `'/login'`).
- [x] Sistemare `'/admin/ticket'` (usata in admin dashboard, non presente in admin routing).
- [x] Sistemare `'/dashboard/ticket'` (usata in booking history, non presente in clients routing).
- [x] Sistemare `'/dashboard/invoices'` (usata in notification service, non presente in clients routing).
- [x] Fare un pass completo sui link menu/CTA/notifiche e validare che ogni route esista davvero.

## P1 - Pagamenti end-to-end

- [ ] Allineare `PaymentApiService` (`src/app/core/services/payments/payment-api.service.ts`) con backend reale.
- [ ] Decidere endpoint unico pagamenti (porta, path, contratto).
- [ ] Implementare backend pagamenti mancante (`/api/payments/create` o equivalente).
- [ ] Integrare conferma pagamento reale (no "simula pagamento riuscito") nel fast-booking.
- [ ] Aggiornare stato booking su conferma webhook/idempotenza.
- [ ] Aggiungere test automatici per flusso pagamento + aggiornamento stato booking.

## P1 - Contratti API e coerenza dominio

- [ ] Allineare contratto scheduling e implementazione:
- [ ] `clientId` in `POST /api/holds`: docs dicono optional, server lo richiede UUID.
- [ ] `POST /api/bookings/confirm`: docs parlano di `contact`, server usa `durationMinutes/bufferMinutes`.
- [ ] Consolidare i `BookingStatus` tra:
- [ ] `src/app/core/models/booking.model.ts`
- [ ] `src/app/core/services/bookings/booking.service.ts`
- [ ] schema SQL in `infra/scripts/001_init.sql`
- [ ] Definire un unico source-of-truth per stati e transizioni lifecycle.

## P2 - Qualita architetturale

- [ ] Decidere strategia dati unica o chiara separazione:
- [ ] Firebase-first con API solo per scheduling, oppure
- [ ] migrazione progressiva su backend PostgreSQL/API.
- [ ] Ridurre i cast `any` nei moduli calendario e allineare tipi forti.
- [ ] Eliminare logica temporanea/scaffold nei componenti admin/client (TODO e simulazioni).
- [ ] Verificare e pulire campi legacy duplicati (`idClient/clientId`, `idArtist/artistId`, `createAt/createdAt`).

## P2 - Documentazione tecnica

- [ ] Completare `docs/SECURITY.md` (auth model, RBAC, RTDB rules, secret management).
- [ ] Completare `docs/RUNBOOK.md` (setup locale, run frontend/api, incident handling).
- [ ] Completare `docs/API_CONTRACTS.md` (contratti finali consolidati).
- [ ] Rifinire `docs/DB_SCHEMA.md` con schema reale aggiornato e relazioni.
- [ ] Aggiungere tabella di allineamento tra docs roadmap e stato implementato.

## P2 - Test e CI

- [ ] Sistemare esecuzione test API (`apps/api`) e dipendenze locali (`vitest`).
- [ ] Definire test minimi obbligatori:
- [ ] scheduling overlap/holds/confirm
- [ ] route guard + access control
- [ ] notifiche e mapping link
- [ ] payment webhook idempotenza
- [ ] lifecycle booking->project->session
- [ ] Aggiungere script standardizzati per run test/build lint.

## P3 - Pulizia UX/UI e contenuti

- [ ] Rimuovere testo accidentale in template (`reminding:` in `home-contact.component.html`).
- [ ] Uniformare naming e copy tra italiano/inglese nei moduli principali.
- [ ] Revisionare sezioni analytics con dati statici e placeholder.
- [ ] Validare tutte le CTA di dashboard admin/cliente.

## P3 - Operativita e ambiente

- [ ] Documentare cause possibili di `ng build` con `spawn EPERM` e workaround ambiente Windows.
- [ ] Definire `.env` template completo per frontend/backend (senza secret reali).
- [ ] Verificare `.gitignore` per evitare leak futuri di credenziali o file runtime.

## Sequenza consigliata

- [x] Step 1: sicurezza (segreti + rules RTDB).
- [x] Step 2: route e navigazione (zero broken links).
- [ ] Step 3: pagamenti reali end-to-end.
- [ ] Step 4: allineamento contratti/stati dominio.
- [ ] Step 5: documentazione e test automation.
