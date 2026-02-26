# 04 - UI/UX Mappa

## Mappa navigazione

### Pubblico
- `/home`
- `/servizi`
- `/progetti`
- `/progetto/:idProgetto`
- `/fast-booking`
- `/chi-siamo`
- `/contatti`

### Cliente (`/dashboard`)
- profilo (`/dashboard`)
- storico booking (`/dashboard/booking-history`)
- chat (`/dashboard/chat`, alias `ticket`)
- recensioni (`/dashboard/reviews`)
- buoni (`/dashboard/buoni`)

### Staff/Admin (`/staff`, `/admin`)
- dashboard, calendario, portfolio, messaging
- utenti/clienti/staff (con guard dedicati)
- bonus, analytics, audit logs, settings

## Shell globale
`AppComponent` gestisce:
- toolbar + menu dinamico per ruolo (`MenuService`)
- notification center con unread badge
- popup chatbot globale
- switch tema automatico basato su route

## Temi visual
Tema applicato al `body`:
- `theme-public` su route pubbliche
- `theme-client` su `/dashboard`
- `theme-admin` su `/admin` e `/staff`

Token CSS centralizzati in:
- `src/styles/theme-public.scss`
- `src/styles/theme-client.scss`
- `src/styles/theme-admin.scss`

## Fast booking UX
Wizard 7 step:
1. `intro`
2. `artist`
3. `when`
4. `details`
5. `summary`
6. `payment`
7. `success`

Caratteristiche:
- prefill dati utente loggato
- lock campi nome/contatto se gia valorizzati
- anti doppio submit pagamento
- gestione errori con messaggi utente

## Qualita UX osservata
- responsive menu mobile via `mat-sidenav`
- notifiche e feedback centralizzati (`UiFeedbackService`)
- fallback route `** -> /home`
