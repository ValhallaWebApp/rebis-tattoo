# 02 - Catalogo Servizi

## Panoramica
Service core rilevati: `21` file in `src/app/core/services`.

## Servizi per dominio

### Auth e sessione
- `AuthService`
  - login/register/logout
  - bootstrap profilo utente da RTDB
  - segnali utente/ruolo/permessi

### Utenti, ruoli, profili
- `UserService`
  - lista utenti gestibili
  - update role/permessi/visibilita
  - vincoli anti auto-demotion e anti ultimo admin
- `StaffService`
- `StudioProfileService`

### Booking, progetto, sessione
- `BookingService`
  - CRUD booking
  - transizioni stato sicure
  - disponibilita slot giornalieri
  - integrazione notifiche
- `ProjectsService`
  - gestione progetti + linkage booking
- `SessionService`

### Catalogo e recensioni
- `ServicesService`
- `ReviewsService` (`rewies.service.ts` nel path attuale)

### Pagamenti e fatture
- `PaymentApiService`
  - endpoint payment API
  - validazione payload FE
  - gestione errori/timeout
- `InvoicesService`

### Messaggistica e notifiche
- `MessagingService`
  - conversazioni + messaggi + unread
- `NotificationService`
  - create/read/mark/delete notifiche

### Altri servizi business
- `BonusService`
- `AuditLogService`
- `LanguageService`
- `MenuService`
- `UiFeedbackService`
- `ConfirmActionService`
- `ChatService` + `LocalLlmService`

## Dipendenze trasversali rilevanti
- `BookingService` dipende da `ProjectsService`, `NotificationService`, `AuditLogService`, `AuthService`
- `MessagingService` dipende da `NotificationService`, `AuditLogService`, `AuthService`
- `UserService` usa conferme UI + audit + sync profili staff

## Nota operativa
Lo strato service contiene sia accesso dati sia logica business. Questo accelera lo sviluppo, ma richiede test regressivi forti su ogni modifica.
