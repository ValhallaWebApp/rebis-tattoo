# Calendar Refactor Roadmap (P0/P1)

## Scope
Analisi su blocco calendario:
- `src/app/features/calendar/**`
- `src/app/shared/components/calendar-v2/**`
- `src/app/features/admin/components/calendar-admin/**`
- `src/app/core/models/**`

Base: report completo `docs/calendar-analisi-completa-2026-02-28.md` (115 file).

## Findings Prioritari

### P0-1: Type safety bassa e dispatch dinamico nei punti core
Sintomo:
- uso esteso di `any` e fallback dinamici su metodi service.
- comportamenti runtime non deterministici (metodo giusto scelto a runtime, non a compile-time).

Evidenze:
- `src/app/features/calendar/calendar.component.ts:15`
- `src/app/features/calendar/calendar.component.ts:73`
- `src/app/features/calendar/calendar.component.ts:78`
- `src/app/features/calendar/calendar.component.ts:262`
- `src/app/features/calendar/calendar.component.ts:310`
- `src/app/features/admin/components/calendar-admin/calendar-admin.component.ts:166`
- `src/app/features/admin/components/calendar-admin/calendar-admin.component.ts:361`

Impatto:
- regressioni silenziose durante refactor service.
- impossibile validare contratti con TypeScript strict.

### P0-2: Modelli calendario duplicati e divergenti
Sintomo:
- stesso concetto (`CalendarView`, `CalendarEvent`) definito in più posti con shape diversi.

Evidenze:
- `src/app/core/models/calendar.model.ts:1`
- `src/app/features/calendar/models.ts:1`
- `src/app/features/calendar/calendar.service.ts:6`
- `src/app/shared/components/calendar-v2/models/calendar.ts:1`
- `src/app/features/calendar/shared/calendar-toolbar/calendar-toolbar.component.ts:22`

Impatto:
- mapping ridondanti.
- mismatch tra feature calendar e calendar-v2.

### P0-3: Gestione date/time non uniforme (rischio timezone drift)
Sintomo:
- mix di stringhe locali e UTC (`toISOString`) nello stesso dominio.

Evidenze:
- `src/app/features/calendar/utils.ts:54`
- `src/app/shared/components/calendar-v2/calendar/views/week-view/week-view.component.ts:76`
- `src/app/shared/components/calendar-v2/calendar/views/week-view/week-view.component.ts:110`

Impatto:
- slittamento giorno/ora su timezone diverse.
- conflitti slot non riproducibili in modo stabile.

### P1-1: Stato reattivo non allineato alla guideline progetto
Sintomo:
- nuovi `BehaviorSubject` in servizi calendario, mentre guideline suggerisce segnali per stato interno.

Evidenze:
- `docs/reactive-state-guideline.md:8`
- `src/app/features/calendar/calendar.service.ts:31`
- `src/app/shared/components/calendar-v2/state/calendar-state/calendar-state.service.ts:15`

Impatto:
- doppio paradigma (Signals + RxJS stateful) e maggiore complessità.

### P1-2: Test gap su dialog critici
Sintomo:
- componenti dialog senza test unitari.

Evidenze:
- `src/app/features/calendar/dialogs/complete-session-dialog/complete-session-dialog.component.ts`
- `src/app/features/calendar/dialogs/create-project-dialog/create-project-dialog.component.ts`

Impatto:
- regressioni su flussi di chiusura sessione/creazione progetto.

### P1-3: Componenti monolitici
Sintomo:
- classi molto grandi con responsabilità miste (UI + orchestration + business mapping).

Evidenze (righe):
- `src/app/features/calendar/calendar-shell/calendar-shell.component.ts` (~1161)
- `src/app/features/calendar/drawer/event-drawer/event-drawer.component.ts` (~817)
- `src/app/features/calendar/calendar.component.ts` (~517)

Impatto:
- manutenzione lenta.
- costo elevato di test e review.

## Piano Esecutivo

## P0 (prima iterazione)
1. Stabilizzare contratti TS e rimuovere dispatch dinamico
- Introdurre interfacce forti per adapter booking/session (`CalendarBookingGateway`, `CalendarSessionGateway`).
- Eliminare `type Booking = any`, `type Session = any`.
- Sostituire fallback dinamici (`createBooking ?? addBooking ?? create`) con un adapter unico typed.

File target:
- `src/app/features/calendar/calendar.component.ts`
- `src/app/features/admin/components/calendar-admin/calendar-admin.component.ts`
- `src/app/features/calendar/models.ts`

DoD:
- zero `type ... = any` in blocco calendar.
- nessun fallback dinamico su metodi service core.

2. Unificare modello calendario
- Definire un solo modulo canonico per `CalendarView`, `CalendarEvent`, payload drag/create.
- Migrare import da `core/models`, `features/calendar`, `shared/calendar-v2` al modulo unico.

File target:
- `src/app/features/calendar/models.ts` (canonico)
- `src/app/shared/components/calendar-v2/models/calendar.ts`
- `src/app/core/models/calendar.model.ts`
- `src/app/features/calendar/calendar.service.ts`

DoD:
- una sola definizione per i tipi calendario condivisi.
- build senza alias duplicati.

3. Normalizzare strategia date/time
- Aggiungere helper unico (es. local date key + local datetime parser/formatter) ed eliminare uso diretto di `toISOString` nel dominio calendario.
- Convertire punti critici week view/calendar utils.

File target:
- `src/app/features/calendar/utils.ts`
- `src/app/shared/components/calendar-v2/calendar/views/week-view/week-view.component.ts`
- `src/app/features/calendar/calendar.service.ts`

DoD:
- nessun `toISOString()` in path di calcolo slot/chiavi giorno.
- test unit su edge timezone (UTC±).

## P1 (seconda iterazione)
1. Riallineare stato a Signals
- Migrare `calendar.service.ts` e `calendar-state.service.ts` verso `signal/computed/effect` con bridge `toObservable` dove necessario.

2. Aumentare test coverage mirata
- Aggiungere spec per:
  - `complete-session-dialog.component.ts`
  - `create-project-dialog.component.ts`
  - test regressione conflict detection e mapping update/create.

3. Decomporre componenti grandi
- Estrarre facade/use-case services da `calendar-shell` e `event-drawer`:
  - preload-lists facade
  - project/session orchestration facade
  - availability/conflict rules service

## Ordine consigliato (pratico)
1. P0-1 (type safety + adapter)  
2. P0-2 (model unification)  
3. P0-3 (datetime normalization)  
4. P1-2 (test gap)  
5. P1-1 + P1-3 (state/facade refactor)

## Comandi di verifica
- `npm run lint`
- `npm run test -- --watch=false`
- `npx playwright test e2e/ui/route-guards.spec.ts e2e/ui/fast-booking.flow.spec.ts`
