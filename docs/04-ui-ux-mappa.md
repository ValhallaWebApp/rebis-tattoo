# 04 - UI/UX Mappa

## Area pubblica
Route:
- `/home`
- `/servizi`
- `/progetti`
- `/progetto/:idProgetto`
- `/fast-booking`
- `/contatti`
- `/chi-siamo`

UX principali:
- landing con sezioni promozionali e CTA
- catalogo servizi/progetti
- wizard fast-booking multi-step

## Area cliente (`/dashboard`)
- profilo
- storico prenotazioni
- chat/ticket
- recensioni
- promo/buoni
- route compat `invoices` -> booking-history

## Area admin (`/admin`)
- dashboard
- calendario
- clienti
- billing
- documenti
- messaging/ticket
- project manager/tracker
- session manager
- bonus
- analytics
- audit logs
- settings

## Fast-booking UX
Step:
1. intro
2. scelta artista
3. data/orario
4. dettagli
5. riepilogo
6. pagamento
7. successo

Migliorie implementate:
- niente simulazione pagamento
- Stripe reale con feedback error/success
- lock anti doppio submit su init/confirm
- stato processing esplicito durante conferma

## Componenti condivisi rilevanti
- `stripe-payment`
- dialog admin/booking/project/service
- componenti calendario v2
- `tattoo-avatar`
- `chat-bot`
