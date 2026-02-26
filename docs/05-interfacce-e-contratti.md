# 05 - Interfacce e Contratti

## Modelli principali (`src/app/core/models`)
- Booking: `Booking`, `BookingStatus`, `BookingChatDraft`
- Project: `Project`, `ProjectStatus`
- Messaging: `Conversation`, `ConversationMessage`, `ParticipantRole`
- User: `AppUser`, `UserRole`, `UserPermissions`
- Notification: `AppNotification`
- Invoice, StaffMember, Client, CalendarEvent

## Contratto pagamenti FE -> API
Service: `PaymentApiService`

### Create Payment Intent
- endpoint: `POST {paymentApiBaseUrl}/create`
- request:
  - `amount` (intero in centesimi)
  - `bookingId`
  - `currency` (`eur|usd|gbp`, default `eur`)
  - `description` opzionale
- response attesa:
  - `success: true`
  - `clientSecret`
  - `paymentIntentId`

## Contratto runtime config
Origine runtime: `window.__APP_CONFIG__` (`public/app-config.js`)

Campi obbligatori validati a bootstrap:
- `paymentApiBaseUrl` (URL assoluto)
- `stripePublishableKey` (`pk_...`)
- `firebaseConfig.*` (chiavi Firebase)

## Contratto RTDB (principali nodi)
- `users`, `adminUids`, `staffProfiles`, `publicStaff`
- `bookings`, `projects`, `sessions`, `invoices`
- `notifications`, `auditLogs`
- `conversations`, `conversationMessages`, `userConversations`
- `services`, `reviews`, `bonus`, `studioProfile`
- `chats`, `chatsByEmail`

## Booking: schema canonico attuale
Campi chiave:
- `clientId`, `artistId`, `projectId?`
- `start`, `end`, `status`
- `source` (`fast-booking|chat-bot|manual`)
- `price`, `depositRequired`, `paidAmount`
- `createdAt`, `updatedAt`, `createdById?`

Regola di compatibilita:
- il service blocca in scrittura alcuni campi legacy (`idClient`, `idArtist`, `description`, `createAt`, `updateAt`).
