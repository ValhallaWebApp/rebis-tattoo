# FASE 2 — Scheduling Engine

## Obiettivi
- Calcolare slot disponibili per staff in Europe/Rome
- Impedire overlap tra bookings, sessions e holds
- Supportare hold TTL per prevenire race condition e gestire pagamenti

## Input
- availability_rules (finestre lavorative)
- bookings + sessions (busy intervals)
- booking_holds non scaduti (busy temporanei)
- durata servizio + buffer + step (es. 45m, buffer 0-15m, step 15m)

## Algoritmo (v1)
1) Normalizza timezone (Europe/Rome)
2) Genera working windows dai rules per il range date
3) Carica busy intervals (bookings held/confirmed, sessions planned/confirmed, holds non scaduti)
4) Applica buffer ai busy intervals
5) available = working - busy (interval subtraction)
6) genera slot a griglia (step) dentro available
7) filtra slot nel passato + lead time minimo
8) restituisci days[] con slots[]

## Concorrenza
- POST /holds: inserisce booking_holds solo se non overlap
- POST /bookings/confirm: transazione atomica (re-check overlap, crea booking, rimuove hold)

## Edge cases
- Oggi: niente slot passati
- DST/ora legale: usare timestamptz
- Hold scaduti: cleanup periodico (cron) o query exclude con expires_at > now()
