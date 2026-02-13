# LLD - Sistema Notifiche

## 1) Data model
Path RTDB: `notifications/{userId}/{notificationId}`

```ts
type NotificationType = 'booking' | 'chat' | 'payment' | 'system';
type NotificationPriority = 'low' | 'normal' | 'high';

interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  priority: NotificationPriority;
  createdAt: string;     // ISO
  readAt: string | null; // null = unread
  meta?: Record<string, string>;
}
```

## 2) NotificationService (core)
File target: `src/app/core/services/notifications/notification.service.ts`

### API minima
1. `getUserNotifications(userId: string): Observable<AppNotification[]>`
2. `getUnreadCount(userId: string): Observable<number>`
3. `createForUser(userId: string, payload: Omit<AppNotification, 'id'|'userId'|'createdAt'|'readAt'>): Promise<string>`
4. `markAsRead(userId: string, notificationId: string): Promise<void>`
5. `markAllAsRead(userId: string): Promise<void>`
6. `delete(userId: string, notificationId: string): Promise<void>` (opzionale)

### Regole
- Sort discendente per `createdAt`
- `readAt` valorizzato con timestamp server/client ISO
- `markAsRead` idempotente

## 3) AppComponent integration
File target: `src/app/app.component.ts`, `src/app/app.component.html`

### Stato
- Rimuovere array statico `notifications = [...]`
- Derivare `userId` da `AuthService.userSig()`
- Esporre:
1. `notifications$: Observable<AppNotification[]>`
2. `unreadCount$: Observable<number>`

### UX
1. Click campanella apre menu
2. Click item:
- `markAsRead(...)`
- `router.navigateByUrl(link)` se presente
3. Azione "Segna tutte come lette"

## 4) Event producers
### BookingService
File: `src/app/core/services/bookings/booking.service.ts`
- `createBooking` -> notifica cliente + staff assegnato
- `updateBooking` (status/date) -> notifica utenti coinvolti
- `delete/cancel` -> notifica impatto alta priorita

### Messaging
File target: modulo messaging (admin/client)
- Nuovo messaggio inbound -> notifica destinatario (non mittente)
- Dedupe semplice su `threadId + messageId`

### Payments
File target: payment service / booking status
- Pagamento ricevuto -> notifica conferma
- Acconto mancante vicino all'appuntamento -> reminder

## 5) Notification factory
File target: `src/app/core/services/notifications/notification-factory.ts`

Funzioni pure consigliate:
1. `fromBookingCreated(...)`
2. `fromBookingUpdated(...)`
3. `fromChatMessage(...)`
4. `fromPaymentReceived(...)`

Obiettivo: centralizzare copy, priorita, link e meta.

## 6) RTDB rules (bozza)
Path: `notifications/{userId}/{notificationId}`
- Read: owner o admin
- Write create/update: owner, admin o system service account
- Validazione campi obbligatori: `type,title,message,createdAt,readAt`

## 7) Telemetria minima
Eventi da tracciare:
1. `notification_created`
2. `notification_opened`
3. `notification_mark_read`
4. `notification_mark_all_read`

## 8) Testing checklist
1. Utente senza notifiche
2. Lista con unread/read misto
3. Mark singola + mark all
4. Routing da notifica a pagina target
5. Doppio update booking in rapida sequenza (no duplicati critici)
6. Logout/login con stato badge coerente

## 9) Piano implementazione
1. Creare model + `NotificationService`
2. Integrare campanella globale in `AppComponent`
3. Agganciare producer BookingService
4. Agganciare producer Messaging
5. Aggiungere reminder/push in fase successiva
