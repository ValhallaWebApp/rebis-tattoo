# 05 - Interfacce e Contratti

## Interfacce dominio (core/models)
- `Booking`, `BookingChatDraft`, `BookingStatus`
- `CalendarEvent`
- `ChatMessage`, `ChatThread`
- `Client`
- `Invoice`
- `Conversation`, `ConversationMessage`
- `AppNotification`, `NotificationType`, `NotificationPriority`
- `Project`
- `TattooService`
- `StaffMember`
- `AppUser`, `UserRole`

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

## Compatibilita legacy note
Persistono campi duplicati in alcuni modelli/servizi:
- `clientId` / `idClient`
- `artistId` / `idArtist`
- `createdAt` / `createAt`
- `updatedAt` / `updateAt`

Il codice include bridge di compatibilita in `BookingService`.
