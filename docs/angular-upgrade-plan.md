# Piano Upgrade Angular (18 -> 20+)

## Obiettivo
Aggiornare il progetto in modo incrementale, mantenendo la produzione stabile e riducendo regressioni su routing, test e integrazioni Firebase.

## Strategia
1. Upgrade major una alla volta (`18 -> 19 -> 20`), senza salti.
2. Ogni fase chiude con gate obbligatori: `lint`, `unit smoke`, `e2e smoke`, `build production`.
3. Congelare nuove feature durante ogni finestra di upgrade.

## Fase 0 - Preparazione
1. Allineare baseline tecnica: Node LTS consigliata da Angular target, npm lock aggiornato.
2. Ridurre warning critici (test flaky, provider mancanti nei test).
3. Confermare pipeline CI minima attiva.

## Fase 1 - Angular 19
1. Eseguire:
```bash
npx ng update @angular/core@19 @angular/cli@19
```
2. Aggiornare librerie accoppiate: `@angular/material`, `@angular/cdk`, `@angular/fire`.
3. Risolvere breaking changes compiler/router/forms.
4. Gate:
   - `npm run lint`
   - `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/core/services/chatBot/chat-bot.service.spec.ts`
   - `npx playwright test e2e/ui/route-guards.spec.ts e2e/ui/fast-booking.flow.spec.ts`
   - `npm run build`

## Fase 2 - Angular 20
1. Eseguire:
```bash
npx ng update @angular/core@20 @angular/cli@20
```
2. Ripetere aggiornamento dipendenze satellite.
3. Valutare adozione graduale API moderne disponibili (dove porta valore reale).
4. Ripetere i gate della Fase 1.

## Fase 3 - Hardening post-upgrade
1. Stabilizzare test unit completi (non solo smoke).
2. Ridurre warning bundle/style budget più rumorosi.
3. Consolidare guideline aggiornate (routing, stato reattivo, testing pattern).

## Rischi principali
1. Test unit legacy con provider incompleti.
2. Incompatibilità temporanee di `@angular/fire` o Storybook.
3. Regressioni di build su budget o plugin toolchain.

## Mitigazioni
1. Branch dedicato per major (`upgrade/angular-19`, `upgrade/angular-20`).
2. Rollback semplice via revert del branch se i gate falliscono.
3. Merge solo con gate verdi.
