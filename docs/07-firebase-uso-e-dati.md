# 07 - Firebase: uso e dati gestiti

## Servizi Firebase usati
- Firebase Auth
- Firestore
- Realtime Database (RTDB)

## Come il frontend usa Firebase

### Auth
- login/register/logout
- risoluzione sessione utente
- bootstrap profilo se assente

### Firestore
- `users` come profilo utente e ruolo applicativo
- query ruoli (admin/staff/client)

### RTDB
Nodi principali gestiti dal FE:
- `bookings`
- `notifications`
- `staffProfiles`
- `projects`
- `sessions`
- `invoices`
- `bonus`
- `conversations`
- `conversationMessages`
- `userConversations`
- `adminUids`

## Rules RTDB (sintesi)
- root deny by default (`.read/.write = false`)
- accesso owner/admin su nodi utente
- nodi pubblici limitati (es. alcune letture servizi/progetti)
- indice dichiarati su nodi ad alta query (`bookings`, `sessions`, `projects`, `bonus`, etc.)

## Dati business principali
- booking: slot, stato, importi, relazioni cliente/artista
- progetto/sessione: pianificazione e avanzamento lavoro
- notifiche: feed utente con priorita e link
- bonus: wallet, codici promo, gift card
- messaging: conversazioni e messaggi multi-ruolo

## Limiti attuali e raccomandazione
Operazioni cross-user sensibili (es. notifiche verso terzi) dovrebbero essere spostate su backend privilegiato (Cloud Functions/API) per robustezza e sicurezza.
