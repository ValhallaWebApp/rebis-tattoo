# Admin 03 - Checklist Go-Live e Controlli

## A. Config ambiente
- [ ] `public/app-config.js` presente e valido
- [ ] `paymentApiBaseUrl` HTTPS corretto
- [ ] `stripePublishableKey` valorizzata
- [ ] `firebaseConfig` completo
- [ ] avvio app senza errori bloccanti di env

## B. Flussi critici
- [ ] login client/admin funzionante
- [ ] fast-booking completo fino a `success`
- [ ] creazione PaymentIntent riuscita
- [ ] conferma Stripe aggiorna booking a `paid`
- [ ] route guard rispettate (`/dashboard`, `/staff`, `/admin`)

## C. Backoffice
- [ ] calendario carica eventi
- [ ] gestione utenti/staff operativa
- [ ] messaging admin operativo
- [ ] notifiche leggibili e azionabili

## D. Qualita tecnica minima
- [ ] `npm run lint` senza errori bloccanti
- [ ] `npm run test` eseguito
- [ ] `npm run test:ui` eseguito
- [ ] nessun errore console critico ricorrente

## E. Rollback readiness
- [ ] snapshot/export RTDB disponibile
- [ ] referente tecnico reperibile
- [ ] piano rollback condiviso

Decisione: se un punto A o B fallisce, non procedere al go-live.
