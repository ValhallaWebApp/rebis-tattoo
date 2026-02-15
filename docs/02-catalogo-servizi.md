# 02 - Catalogo Servizi

## Core servizi principali

### Auth e utenti
- `AuthService` (`core/services/auth/authservice.ts`)
  - login/register/logout
  - risoluzione sessione corrente
  - bootstrap profilo utente in Firestore
- `UserService` (`core/services/users/user.service.ts`)
  - lista utenti/clienti gestibili
  - update/hide utente con vincoli admin
  - merge dati Firestore + RTDB

### Booking e scheduling
- `BookingService` (`core/services/bookings/booking.service.ts`)
  - CRUD booking
  - ricerca slot liberi
  - transizioni stato sicure (`safeSetStatus`)
  - notifiche collegate al ciclo booking
- `BookingDraftService`
  - gestione draft in-memory

### Pagamenti
- `PaymentApiService` (`core/services/payments/payment-api.service.ts`)
  - create payment intent
  - validazione payload lato FE
  - mapping errori backend
  - wrapper safe result (`ok/error`)

### Staff, progetti, sessioni
- `StaffService`
- `ProjectsService`
- `SessionService`

### Notifiche e messaging
- `NotificationService`
  - create, read, mark, delete notifiche per utente
- `MessagingService`
  - conversazioni, messaggi, stato lettura, permessi per ruolo

### Altri domini
- `BonusService`
- `InvoicesService`
- `ServicesService`
- `ReviewsService`
- `StudioProfileService`
- `UiFeedbackService`
- `AuditLogService`

## Servizi adapter/utility
- `BookingAdapterService`
- `StaffAdapterService`
- `TattooBookingAgentService`
- `LanguageService`
- `MenuService`
- `TattooAreaService`

## Nota operativa
I servizi non sono omogenei al 100%: alcuni sono model-driven e robusti, altri mantengono compat legacy con campi duplicati (`clientId/idClient`, `artistId/idArtist`).
