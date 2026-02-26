# 01 - Architettura Frontend

## Obiettivo applicativo
Piattaforma gestionale per studio tattoo con tre aree operative:
- area pubblica (marketing + fast booking)
- area cliente (profilo, storico, chat)
- area staff/admin (operativita, portfolio, controllo)

## Stack reale
- Angular `18.2.x`
- Angular Material + CDK
- RxJS + Angular Signals (uso misto)
- AngularFire (`auth`, `database`, `firestore`)
- Stripe Elements (`@stripe/stripe-js`)
- FullCalendar + ngx-charts + d3 + xlsx

## Bootstrap applicazione
Bootstrap in `src/main.ts`:
1. registrazione locale `it-IT`
2. validazione config runtime (`validateEnvironmentOrThrow`)
3. `bootstrapApplication(AppComponent, appConfig)`

Provider principali (`src/app/app.config.ts`):
- `provideRouter(routes, withHashLocation())`
- `provideHttpClient(withInterceptors([authHttpInterceptor]))`
- `provideAnimationsAsync()`
- provider Firebase app/auth/firestore/database

## Struttura codice
- `src/app/core`
  - config, guard, interceptor, modelli, servizi
- `src/app/features`
  - `public`, `clients`, `admin`, `calendar`, `auth`
- `src/app/shared`
  - componenti riusabili (dialog, chat bot, stripe-payment, calendar-v2)

L'app e ibrida:
- molte feature sono standalone component
- restano moduli NgModule in alcune aree (`home.module`, `admin.module`, `clients.module`)

## Routing principale
Entry routes (`app.routes.ts`):
- pubbliche: `/home`, `/servizi`, `/progetti`, `/progetto/:idProgetto`, `/fast-booking`, `/chi-siamo`, `/contatti`
- auth: `/login`, `/register`
- protette:
  - `/dashboard` con `AuthGuard`
  - `/staff` con `AdminGuard`
  - `/admin` con `AdminOnlyGuard`

Nota: il routing usa hash location, quindi in browser verra servito come `/#/route`.

## Pattern reattivi
- stato utente in `AuthService` con `signal` + `computed`
- flussi complessi (fast-booking, calendario, chat) con mix `signal`, `effect`, Observable
- forms prevalenti: Reactive Forms classiche (non Signal Forms)

## Flusso critico: fast-booking + pagamento
1. wizard raccoglie artista, slot, dati utente, descrizione
2. creazione bozza booking RTDB (`BookingService.addDraftFromChat`)
3. richiesta PaymentIntent (`PaymentApiService -> /api/payments/create`)
4. conferma Stripe Elements (`StripePaymentComponent`)
5. aggiornamento stato booking (`draft/pending -> confirmed -> paid`)
6. step finale `success`

## Vincoli architetturali attuali
- operazioni cross-user (es. notifiche a terzi) dipendono dalle RTDB rules
- logica di dominio ricca sul frontend (da ridurre lato client nel medio termine)
- nessuna configurazione SSR/hydration presente
