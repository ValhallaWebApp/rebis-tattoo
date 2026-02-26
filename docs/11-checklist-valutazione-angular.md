# 11 - Checklist Valutazione Angular

## Valutazione sintetica
Stato generale: buono ma con debito tecnico medio-alto.

Indicatori rilevati:
- componenti: 96
- standalone: 84
- definizioni NgModule: 7
- service: 25
- guard: 5
- test unit (`*.spec.ts`): 81
- test e2e UI: 1
- storie Storybook: 1
- riferimenti `any`: 686
- componenti OnPush: 11
- uso `httpResource/resource`: 0

## Checklist prioritaria

### P0 - Bloccanti o ad alto rischio
- [ ] Allineare schema mock messaging: il dataset genera `messages`, il runtime usa `conversationMessages`.
- [ ] Definire policy ambiente production per Stripe: evitare `pk_test_*` in produzione reale.
- [ ] Spostare azioni cross-user sensibili lato backend privilegiato (notifiche/sync) per ridurre dipendenza da regole RTDB in UI.
- [ ] Stabilire test e2e obbligatori su flusso `fast-booking -> payment -> booking paid` (oggi e presente 1 solo e2e visual).

### P1 - Alta priorita (qualita e manutenibilita)
- [ ] Ridurre gradualmente `any` nei service core (`bookings`, `users`, `fast-booking`, `messaging`) partendo dalle API pubbliche.
- [ ] Uniformare naming file/service anomali (`rewies.service.ts`, `authservice.ts`) per evitare errore umano e import fragili.
- [ ] Standardizzare strategia routing: consolidare mix `NgModule routes` + `standalone loadComponent/loadChildren` verso pattern unico.
- [ ] Aumentare copertura test su guard e transizioni stato booking (`safeSetStatus`, reschedule, cancellation).
- [ ] Introdurre suite Playwright per route protette (`/dashboard`, `/staff`, `/admin`) e regressione ruolo/permessi.

### P2 - Miglioramenti strutturali
- [ ] Portare piu componenti a `ChangeDetectionStrategy.OnPush` (oggi 11/96).
- [ ] Consolidare pattern stato: ridurre mix `BehaviorSubject`/signal dove non necessario.
- [ ] Valutare introduzione graduale di `httpResource/resource` nei casi read-heavy e UI state-driven.
- [ ] Ridurre residui NgModule non indispensabili dopo migrazione a standalone full.
- [ ] Estendere Storybook oltre 1 storia per componenti shared critici (dialog, payment, chat bot, calendar blocks).

## Checklist per skill

### angular-tooling
- [ ] Aggiungere target CI minimi: lint + unit + e2e smoke.
- [ ] Definire budget bundle piu stringenti per warning/error su build production.
- [ ] Pianificare upgrade Angular progressivo (18 -> 19/20+) con branch dedicato.

### angular-routing
- [ ] Documentare matrice route/guard/data permission in un file unico.
- [ ] Introdurre `withComponentInputBinding()` se si vuole ridurre codice `ActivatedRoute` boilerplate.
- [ ] Normalizzare fallback e redirect post-login (`pre-log`) con test dedicati.

### angular-signals
- [ ] Isolare i "store" principali in servizi dedicati con API `readonly` chiare.
- [ ] Eliminare side effect ridondanti negli `effect()` del fast-booking.
- [ ] Applicare naming consistente (`*_sig`, `*_computed`) per leggibilita.

### angular-http
- [ ] Centralizzare error mapping HTTP in utility comune (oggi disperso tra servizi).
- [ ] Uniformare timeout/retry policy per endpoint critici.
- [ ] Formalizzare contratti DTO request/response per payment API e servizi RTDB-bridge.

### angular-testing
- [ ] Definire test matrix minima per ogni dominio core (auth, booking, payment, messaging, users).
- [ ] Coprire componenti standalone OnPush con test input/output e change detection.
- [ ] Aggiungere test integration su `FastBookingStore` con mocking `BookingService` e `PaymentApiService`.

## Piano consigliato in 3 sprint

### Sprint 1 (stabilita)
- [ ] Chiudere P0 su schema messaging mock/runtime.
- [ ] E2E pagamento end-to-end.
- [ ] Harden permessi cross-user via backend.

### Sprint 2 (qualita codice)
- [ ] Riduzione `any` in domini core.
- [ ] Naming cleanup file/servizi.
- [ ] Copertura test guard + booking status.

### Sprint 3 (modernizzazione Angular)
- [ ] Uniformazione routing/standalone.
- [ ] Adozione selettiva OnPush + signals pattern.
- [ ] Valutazione upgrade Angular e adozione `httpResource` dove utile.
