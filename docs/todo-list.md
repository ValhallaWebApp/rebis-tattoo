# TODO Progetto

1. [x] Allineare dataset e runtime messaging (`messages` vs `conversationMessages`).
2. [x] Mettere policy ambiente: vietare `pk_test_*` in produzione reale.
3. [x] Spostare notifiche/sync cross-user da frontend a backend privilegiato.
4. [x] Aggiungere e2e critico: `fast-booking -> payment -> booking paid`.
5. [x] Aggiungere e2e per route guard (`/dashboard`, `/staff`, `/admin`).
6. [x] Ridurre `any` nei service core (`bookings`, `users`, `fast-booking`, `messaging`).
7. [x] Rinominare file anomali (`rewies.service.ts`, `authservice.ts`) e aggiornare import.
8. [x] Uniformare routing (ridurre mix NgModule + standalone dove possibile).
9. [x] Portare piu componenti a `OnPush`.
10. [x] Standardizzare stato reattivo (signals vs `BehaviorSubject`) con regola unica.
11. [x] Introdurre pattern equivalente (`toSignal` per letture UI; `resource/httpResource` non disponibile in questa versione Angular).
12. [x] Centralizzare gestione errori HTTP (mapper unico).
13. [x] Uniformare timeout/retry policy per chiamate critiche.
14. [x] Definire DTO tipizzati per API payment e bridge RTDB.
15. [x] Aumentare Storybook per componenti shared critici.
16. [x] Definire CI minima: `lint + unit + e2e smoke`.
17. [x] Stringere budget bundle in build production.
18. [x] Pianificare upgrade Angular progressivo (18 -> 19/20+).
