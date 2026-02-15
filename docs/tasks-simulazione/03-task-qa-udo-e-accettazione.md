# Task Simulazione 03 - QA, UAT e Accettazione

## Test funzionali (UAT)
- [ ] Login utente client e navigazione dashboard.
- [ ] Prenotazione fast-booking completa fino a `success`.
- [ ] Verifica booking in RTDB con stato `paid`.
- [ ] Verifica accessi admin/staff/client su route protette.

## Test tecnici
- [ ] Verifica caricamento `app-config.js` (no 404).
- [ ] Verifica CORS endpoint payment API.
- [ ] Verifica gestione timeout/errori payment API.
- [ ] Verifica assenza doppio submit pagamento.

## Test sicurezza
- [ ] Tentativo scrittura cross-user notifiche con ruolo client (deve fallire senza bloccare UX).
- [ ] Verifica accesso non admin a route admin-only.
- [ ] Verifica dati sensibili non esposti in log UI.

## Criteri accettazione release
- [ ] Nessun blocker su flow booking+payment.
- [ ] Nessun errore console critico ripetitivo.
- [ ] Config ambiente documentata e replicabile.
- [ ] Stakeholder approva test demo.
