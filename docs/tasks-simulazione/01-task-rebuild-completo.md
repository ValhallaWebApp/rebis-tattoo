# Task Simulazione 01 - Rebuild Completo (stato attuale + delta)

## Obiettivo
Portare il progetto da stato ibrido attuale a baseline stabile e piu uniforme.

## Stato sintetico
- [x] base Angular/Firebase/Material operativa
- [x] aree public/client/admin operative
- [x] fast-booking + payment flow funzionante
- [ ] uniformita architetturale completa (standalone-first)
- [ ] test e2e completi sui flussi core

## Workstream

### WS1 - Architettura frontend
- [ ] ridurre moduli legacy residui non necessari
- [ ] uniformare naming e struttura feature
- [ ] eliminare cast `any` nei servizi core

### WS2 - Dominio dati
- [ ] completare migrazione campi legacy booking
- [ ] validare allineamento schema mock/runtime/rules
- [ ] definire contratti DTO stabili per API interne

### WS3 - Qualita
- [ ] aumentare copertura unit test su booking/auth/messaging
- [ ] aggiungere e2e su pagamento e route guard
- [ ] introdurre gate CI minimi (lint + test)

### WS4 - Operativita
- [ ] hardening runbook admin
- [ ] checklist go-live automatizzabile
- [ ] telemetria minima errori critici
