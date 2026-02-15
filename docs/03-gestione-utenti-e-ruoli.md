# 03 - Gestione Utenti e Ruoli

## Ruoli applicativi
- `admin`
- `staff`
- `client`
- `public`
- `guest`

## Controllo accessi frontend
- `AuthGuard`: permette area dashboard a client/admin/staff autenticati
- `AdminGuard`: permette area admin a admin/staff
- `AdminOnlyGuard`: permette route strettamente admin

## Profilazione utente
- Source principale: Firestore collection `users`
- Supporto role inference iniziale:
  - `adminUids/{uid}` in RTDB
  - `staffProfiles/{uid}` in RTDB

## Regole pratiche nel codice
- auto-creazione profilo utente al primo login se mancante
- vincolo: un admin non puo declassare se stesso
- vincolo: non si puo nascondere l'ultimo admin visibile

## Gestione notifiche per ruolo
- lettura notifiche: owner o admin
- scrittura notifiche su altri utenti: solo admin (per rules RTDB)
- comportamento FE: per attore non-admin si limita invio a se stesso

## Sessione e UX login
- `pre-log` in localStorage per redirect post-login
- route fallback `/access-denied` per accessi non autorizzati
