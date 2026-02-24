# 05 - Interfacce e Contratti

## Interfacce dominio (core/models)
- `Booking`, `BookingChatDraft`, `BookingStatus`
- `Conversation`, `ConversationMessage`, `ParticipantRole`
- `Project`, `ProjectStatus`
- `AppUser`, `UserRole`, `UserPermissions`
- `StaffMember`
- `Invoice`
- `AppNotification`, `NotificationType`, `NotificationPriority`

## Interfacce servizi (core/services)
- Auth:
  - `AppUser`
- Payments:
  - `CreatePaymentRequest`
  - `PaymentIntentResultOk/Err`
- Audit:
  - `AuditLogEvent`, `AuditLogRecord`
- Bonus:
  - `PromoCode`, `GiftCard`, `UserWallet`, `WalletLedgerEntry`
- Messaging:
  - `ConversationStatus`, `MessageKind`, `ParticipantRole`

## Contratto RTDB allineato al dataset attuale
Root nodes principali:
- `auditLogs`
- `bookings`
- `conversations`
- `projects`
- `services`
- `sessions`
- `staffProfiles`
- `userConversations`
- `users`

Pattern dati attuali:
- Booking:
  - canonico: `clientId`, `artistId`, `createdAt`, `updatedAt`, `notes`, `projectId`
  - i campi legacy `idClient`, `idArtist`, `createAt`, `updateAt`, `description` sono bloccati in scrittura dal service
- Session:
  - canonico: `artistId`, `clientId`, `projectId`, `bookingId` (opzionale), `start`, `end`
- Project:
  - prevale `artistId`/`clientId` con `bookingId`, `sessionIds[]`
- User:
  - campi completi profilo (`id`, `uid`, `role`, `permissions`, `isActive`, `isVisible`, `urlAvatar`, ecc.)
- Conversation:
  - `participants: Record<uid, role>`
  - `unreadBy: Record<uid, number>`

## Contratto Payment API usato dal frontend
Request `POST /create`:
- `amount: number` (cents)
- `bookingId: string`
- `currency?: 'eur'|'usd'|'gbp'`
- `description?: string`

Response:
- `success: boolean`
- `clientSecret: string`
- `paymentIntentId: string`

## Contratto runtime config (`window.__APP_CONFIG__`)
- `paymentApiBaseUrl`
- `stripePublishableKey`
- `firebaseConfig`:
  - `apiKey`
  - `authDomain`
  - `databaseURL`
  - `projectId`
  - `storageBucket`
  - `messagingSenderId`
  - `appId`
  - `measurementId?`

## Note compatibilita
Il codice mantiene bridge attivi per alias legacy, in particolare su:
- `BookingService`
- `SessionService`
- `ProjectsService` (read/write misti su dataset eterogenei)
