# Dataset Test RTDB (allineato snapshot operativo)

## Root presenti
- `auditLogs`
- `bookings`
- `conversations`
- `projects`
- `services`
- `sessions`
- `staffProfiles`
- `userConversations`
- `users`

## Utenti presenti nello snapshot
- `1EoVwmdPbXWdjpD8MIQuVxQOFlv2` (`test.admin@gmail.com`)
- `Ygu8JDe9fbPFsb2ZFQ0pSkOpkAV2` (`client.test@gmail.com`)
- `v97oOiulG1M71jtiVYpSo8FN6Ap1` (`staff.test@gmail.com`)

## Stato schema reale (importante)
- Booking mantiene campi doppi:
  - canonici: `clientId`, `artistId`, `createdAt`, `updatedAt`, `notes`
  - legacy: `idClient`, `idArtist`, `createAt`, `updateAt`, `description`
- Session usa prevalentemente `idArtist`/`idClient`.
- Project usa `artistId`/`clientId` e link `bookingId`, `sessionIds`.
- Conversation usa `participants` e `unreadBy` per utente.
- Services usa naming italiano (`categoria`, `prezzo`, `durata`, `visibile`).

## Audit log osservato
- Eventi `auth.register` con errori `PERMISSION_DENIED` e `auth/*`.
- Eventi `user.update.staffSync` ripetuti in errore (sync staff profile).
- Eventi `booking.update` e `messaging.conversation.create` coerenti con flussi admin.

## Nota operativa
Questo dataset non e "pulito/normalizzato": rappresenta uno stato reale di esercizio.
Il frontend deve quindi continuare a supportare sia campi canonici sia alias legacy.
