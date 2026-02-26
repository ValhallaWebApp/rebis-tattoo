# Task Simulazione 03 - QA, UAT e Accettazione

## Ambito test minimo obbligatorio

### 1) Funzionale utente
- [ ] login/register con profilo valido
- [ ] navigazione area pubblica e dashboard
- [ ] fast-booking fino a step `payment`
- [ ] pagamento completato con aggiornamento stato booking

### 2) Funzionale backoffice
- [ ] accesso `/staff` con staff autorizzato
- [ ] blocco accesso `/admin` per non-admin
- [ ] gestione booking da calendario
- [ ] gestione utenti/permessi admin-only

### 3) Messaging e notifiche
- [ ] creazione conversazione cliente
- [ ] invio/ricezione messaggi con unread counter
- [ ] mark-as-read e navigazione da notifica

### 4) Tecnico
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run test:ui`
- [ ] nessun errore runtime bloccante in console

## Criteri di accettazione release
- [ ] nessun blocker P1 su flow booking+payment
- [ ] nessun blocker su auth/guard/ruoli
- [ ] configurazione ambiente replicabile e documentata
- [ ] runbook operativo approvato

## Evidenze richieste
- report test (lint/unit/e2e)
- screenshot o log dei flussi critici
- checklist go-live compilata
