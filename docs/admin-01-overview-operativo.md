# Admin 01 - Overview Operativo

## Scopo
Guida rapida per titolare e amministrazione studio.

## Cosa gestisci nel gestionale
- prenotazioni e calendario
- clienti e staff
- progetti e sessioni
- pagamenti/caparre
- messaggistica e notifiche
- audit e controllo operativo

## Aree principali da menu
### Frontoffice pubblico
- home, servizi, progetti, fast-booking, contatti

### Area cliente (`/dashboard`)
- profilo
- storico booking
- chat
- recensioni
- buoni

### Backoffice (`/admin` e `/staff`)
- calendario
- utenti/clienti/staff
- portfolio/progetti
- servizi
- bonus
- analytics e audit logs

## Flusso business principale
1. cliente invia fast-booking
2. sistema crea bozza booking
3. pagamento caparra via Stripe
4. booking aggiornato a `paid`
5. presa in carico operativa staff/admin

## KPI giornalieri consigliati
- nuove prenotazioni in `pending`
- pagamenti non completati
- messaggi non letti
- agenda giornata successiva
- errori operativi segnalati dal team
