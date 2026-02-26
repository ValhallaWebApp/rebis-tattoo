# Task Simulazione 02 - Roadmap per Release

## Release plan proposto

### Fase 1 - Stabilita tecnica
- [ ] chiudere mismatch schema dati (booking/messaging)
- [ ] hardening env/runtime config in tutti gli ambienti
- [ ] validare payment API contract in stage

### Fase 2 - Qualita flussi core
- [ ] test e2e: login -> fast-booking -> pagamento -> successo
- [ ] test e2e: admin gestione booking/progetto/sessione
- [ ] test regressione route guard e permessi staff

### Fase 3 - Security e governance
- [ ] spostare operazioni cross-user sensibili su backend
- [ ] audit rules RTDB su path ad alta criticita
- [ ] policy logging errori senza dati sensibili

### Fase 4 - Performance e UX
- [ ] ottimizzare warmup chatbot locale
- [ ] ridurre tempi percepiti wizard fast-booking
- [ ] migliorare feedback errori utente lato pagamenti

### Fase 5 - Go-live controllato
- [ ] dry-run completo con checklist admin
- [ ] export dati e piano rollback validati
- [ ] sign-off stakeholder tecnico + business
