# 01 - Architettura Frontend

## Stack applicativo
- Angular 18
- Angular Router con lazy loading
- Angular Material
- RxJS + Signals
- Firebase Web SDK via `@angular/fire`
- Stripe Elements (`@stripe/stripe-js`)

## Struttura ad alto livello
- `src/app/core`: servizi, model, guard, moduli condivisi
- `src/app/features/public`: area pubblica e fast-booking
- `src/app/features/clients`: area cliente
- `src/app/features/admin`: area amministrativa/staff
- `src/app/shared`: componenti condivisi riusabili

## Config bootstrap
- Router con `withHashLocation()`
- Locale `it-IT`
- Firebase app inizializzata da `environment.firebaseConfig`
- Validazione config runtime all'avvio (`validateEnvironmentOrThrow`)

## Routing principale
- `/home`, `/servizi`, `/progetti`, `/progetto/:idProgetto`, `/fast-booking`, `/contatti`, `/chi-siamo`
- `/dashboard/*` (protetto da `AuthGuard`)
- `/admin/*` (protetto da `AdminGuard`)
- `/access-denied`

## Flusso tecnico fast-booking + pagamento
1. raccolta dati utente/artista/data/descrizione (wizard)
2. creazione bozza booking in RTDB
3. chiamata Payment API `/create`
4. Stripe Elements `confirmPayment`
5. aggiornamento stato booking: `draft/pending -> confirmed -> paid`
6. passaggio step `success`

## Tradeoff attuali
- parte logica business e notifiche gira ancora nel frontend
- alcune operazioni cross-user dipendono da vincoli rules RTDB
- convergenza verso backend privilegiato consigliata per operazioni sensibili
