# Dataset Test Simulazione

## Origine
Dataset generato da script:
- `scripts/generate-rich-mock-dataset.js`

File prodotti:
- `firebase-rtdb-export.mock.json`
- `firebase-rtdb-export.mock.safe.json`
- `firestore-users.mock.json`
- `firebase-unified.mock.json`
- `mock-demo-playbook.json`

## Contenuto mock (versione script attuale)
- utenti: `10`
- progetti: `6`
- booking: `6`
- sessioni: `12`
- recensioni: `12`

Include dati per:
- admin/staff/client
- portfolio e progetti multi-stato
- booking da fonti diverse (`manual`, `fast-booking`, `chat-bot`)
- conversazioni e notifiche demo

## Credenziali demo (mock playbook)
- admin owner: `valhallawebapp@gmail.com` / `131099`
- staff operator: `staff.test@rebistattoo.it` / `131099`
- client demo: `cliente.alfa@rebistattoo.it` / `131099`

## Comandi utili
- genera mock: `npm run db:generate:mock`
- import RTDB mock safe: `npm run db:import:mock`
- import Firestore users mock: `npm run db:import:firestore-users`

## Attenzione su coerenza schema
Il dataset deve restare allineato con:
- path usati nei service runtime
- rules in `database.rules.json`

In caso di mismatch (es. nodi messaging), correggere prima i generatori o i service, poi rigenerare.
