# Task Simulazione 01 - Rebuild Completo Progetto

## Epic A - Fondazione
- [ ] Inizializzare workspace Angular 18 con routing e Material.
- [ ] Configurare struttura `core/features/shared`.
- [ ] Impostare ambiente runtime (`app-config.js`) + validazione bootstrap.

## Epic B - Integrazione Firebase
- [ ] Configurare provider AngularFire (auth/firestore/database).
- [ ] Implementare `AuthService` con bootstrap profilo utente.
- [ ] Definire rules RTDB base deny-by-default.

## Epic C - Dominio booking
- [ ] Implementare model `Booking` e `BookingStatus`.
- [ ] Implementare `BookingService` con CRUD e transizioni sicure.
- [ ] Implementare calcolo disponibilita slot giornalieri.

## Epic D - Payment flow
- [ ] Implementare `PaymentApiService` con contratto `/create`.
- [ ] Integrare Stripe Elements (`stripe-payment` component).
- [ ] Collegare conferma pagamento a update stato booking.

## Epic E - Aree UI
- [ ] Costruire area pubblica (home, servizi, progetti, contatti).
- [ ] Costruire area cliente (profilo, booking history, messaging).
- [ ] Costruire area admin (calendar, clients, billing, analytics).

## Epic F - Qualita
- [ ] Test unit base services core.
- [ ] Test integration fast-booking flow.
- [ ] Runbook operativo + checklist pre-release.
