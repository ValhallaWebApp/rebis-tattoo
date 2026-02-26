# 08 - Stato Progetto e Cosa e stato fatto

## Stato attuale (As-Is)
Il prodotto e utilizzabile sui flussi principali:
- navigazione pubblico/client/admin
- auth e gestione ruoli
- fast-booking con pagamento Stripe
- calendario/booking/progetti/sessioni
- messaggistica e notifiche

## Punti consolidati
- runtime config esterna (`app-config.js`) + validazione bootstrap
- payment flow collegato a backend Cloud Functions
- hardening transizioni stato booking
- guard route e permessi staff/admin gia operativi
- chatbot locale con pipeline worker e fallback

## Debito tecnico aperto
- architettura ibrida (standalone + moduli) da uniformare
- presenza di `any` in aree core (booking/fast-booking)
- parte logica business critica ancora lato frontend
- copertura e2e limitata (attualmente 1 spec visual home)
- convergenza naming legacy/canonico ancora incompleta in alcuni dati storici

## Rischi principali
- regressioni su flusso pagamento senza test end-to-end estesi
- mismatch possibili tra dataset mock e rules runtime
- gestione notifiche cross-user dipendente da permessi runtime

## Priorita consigliate
1. estendere test e2e su fast-booking e pagamenti
2. spostare operazioni sensibili su backend privilegiato
3. ridurre `any` e rafforzare contratti tipizzati
4. completare migrazione verso componenti/feature completamente standalone
