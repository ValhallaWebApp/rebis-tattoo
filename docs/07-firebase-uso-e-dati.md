# 07 - Firebase: uso e dati

## Servizi Firebase usati
- Firebase Auth
- Realtime Database (centrale)
- Firestore (provider attivo, uso secondario)

## Dove viene usato
- Auth: login/register/sessione corrente
- RTDB: dominio principale (utenti, booking, progetti, chat, notifiche)
- Firestore: presente ma non dominante nei flussi core attuali

## Regole RTDB (`database.rules.json`)
Impostazione base:
- root deny by default (`.read/.write = false`)

Pattern autorizzativi:
- owner o admin per molti nodi utente
- staff attivo abilitato su nodi operativi specifici
- nodi pubblici in sola lettura per catalogo/visibilita (`services`, `studioProfile`, `publicStaff`)

Nodi con `indexOn` gia dichiarati:
- `bookings`, `sessions`, `projects`, `invoices`, `payments`, `bonus`, `notifications`

## Nodi business principali
- access/ruoli: `users`, `adminUids`, `staffProfiles`, `publicStaff`
- operazioni: `bookings`, `projects`, `sessions`, `invoices`, `payments`
- comunicazione: `notifications`, `conversations`, `conversationMessages`, `userConversations`, `chats`, `chatsByEmail`
- controllo: `auditLogs`, `bonus`, `reviews`, `services`, `studioProfile`

## Funzioni cloud correlate
`functions/index.js` espone `paymentApi` (region `europe-west1`) con endpoint:
- `POST /api/payments/create`
- `POST /api/payments/confirm` (test-gated)
- `POST /api/payments/webhook`
- `GET /health`

## Note operative
- azioni cross-user dal frontend possono essere limitate dalle rules (gestire fallback UX)
- path dati mock e path runtime devono restare allineati (specialmente messaging)
