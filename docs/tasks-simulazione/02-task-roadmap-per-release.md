# Task Simulazione 02 - Roadmap per Release

## Sprint 1 - Security e Config
- [ ] Rimuovere ogni valore sensibile hardcoded dal codice.
- [ ] Standardizzare `app-config.js` per dev/stage/prod.
- [ ] Validare env al bootstrap con errori bloccanti.

## Sprint 2 - Booking affidabile
- [ ] Consolidare schema booking (campi canonical + compat).
- [ ] Uniformare transizioni stato e gestione errori UI.
- [ ] Ridurre dipendenze da cast `any` nei flussi principali.

## Sprint 3 - Payments production-ready
- [ ] Allineare FE/BE su amount server-side.
- [ ] Gestire fallback/retry utente in caso di failure parziali.
- [ ] Verificare comportamento webhook-driven post pagamento.

## Sprint 4 - Firebase governance
- [ ] Revisione rules RTDB per tutti nodi business.
- [ ] Spostare operazioni cross-user sensibili su backend.
- [ ] Audit su accessi admin/staff e visibilita dati.

## Sprint 5 - QA e go-live
- [ ] Test regressione full flow (public/client/admin).
- [ ] Hardening console errors/warnings.
- [ ] Demo checklist firmata + release note.
