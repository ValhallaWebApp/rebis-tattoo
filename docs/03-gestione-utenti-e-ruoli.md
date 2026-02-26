# 03 - Gestione Utenti e Ruoli

## Ruoli applicativi
Tipi usati nel codice:
- `admin`
- `staff`
- `client`
- `public`
- `guest`
- `user` (compat legacy, trattato come client in alcuni flussi)

## Permessi staff granulari
Esempi chiave in `UserPermissions`:
- `canManageRoles`
- `canManageBookings`
- `canManageProjects`
- `canManageSessions`
- `canManageMessages`
- `canViewAnalytics`
- `canViewAuditLogs`

## Guard e controllo route
- `AuthGuard`
  - consente `/dashboard` a utenti autenticati con ruolo valido
- `AdminGuard`
  - consente `/staff` a `admin` o `staff`
- `AdminOnlyGuard`
  - consente `/admin` solo a `admin`
- `RoleManagementGuard`
  - limita sezioni gestione ruoli
- `StaffPermissionGuard`
  - controlla `route.data.permission` per staff

## Flusso account
### Register
1. crea utente Firebase Auth
2. costruisce payload profilo completo
3. scrive `users/{uid}` in RTDB
4. verifica persistenza e carica profilo in signal

### Login
1. autenticazione Firebase
2. lettura `users/{uid}` RTDB
3. normalizzazione profilo

## Vincoli business gia implementati
- admin non puo cambiare il proprio ruolo
- non si puo rimuovere/nascondere l ultimo admin visibile
- sync automatico `staffProfiles`/`publicStaff` nei cambi ruolo

## Nodi dati coinvolti
- `users`
- `adminUids`
- `staffProfiles`
- `publicStaff`

## Redirect post-login
- la route richiesta prima del login viene salvata in `localStorage.pre-log`
- redirect verso `/access-denied` su accessi non autorizzati
