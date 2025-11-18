
# 🧩 HLD – Prenotazioni Studio Tattoo (BookingService-based)

## 👥 1. Attori del sistema

| Ruolo     | Descrizione                                                         |
|-----------|---------------------------------------------------------------------|
| **Client**  | Utente autenticato, può creare, visualizzare, modificare i propri booking |
| **Admin**   | Tatuatore o segreteria, gestisce tutti i booking e può modificarne stato/data |
| **System**  | Automazioni backend (email, fatture, reminder, review request)    |

## 📌 2. Stato della prenotazione (`BookingStatus`)

```ts
type BookingStatus =
  | 'draft'      // creato ma non ancora pagato
  | 'paid'       // acconto versato
  | 'on-going'   // appuntamento in corso
  | 'completed'  // sessione completata
  | 'cancelled'  // annullato
```

## 📦 3. Struttura `Booking` (estesa)

```ts
interface Booking {
  id: string;
  idClient: string;
  idArtist: string;
  title: string;
  description: string;
  start: string;
  end: string;
  eta?: string;
  status: BookingStatus;
  price: number;
  paidAmount?: number;
  createAt: string;
  updateAt: string;

  cancelledBy?: string;
  cancelReason?: string;
  rescheduleCount?: number;
  lastRescheduledAt?: string;
}
```

## 🔗 4. Entità correlate

| Entità     | Relazione           | Chiave esterna  | Descrizione                  |
|------------|---------------------|------------------|------------------------------|
| `Review`   | 1 → 1               | `bookingId`      | Collegata alla fine della sessione |
| `Invoice`  | 1 → 1               | `bookingId`      | Fattura generata dal backoffice |
| `Client`   | N → 1               | `idClient`       | Utente autenticato           |
| `Artist`   | N → 1               | `idArtist`       | Operatore assegnato          |

## 🧠 5. Ciclo di vita booking

addDraft() → setStatus(paid) → setStatus(on-going) → setStatus(completed)  
 ↳ setStatus(cancelled)  
 ↳ Review & Invoice generate con bookingId

## 🛠️ 6. Metodi chiave del BookingService

| Metodo                      | Descrizione                                                |
|-----------------------------|-------------------------------------------------------------|
| `addDraft()`                | Crea prenotazione bozza (status: `'draft'`)                |
| `setStatus(id, status)`     | Cambia stato della prenotazione in modo centralizzato       |
| `updateBooking()`           | Modifica parziale di una prenotazione                       |
| `deleteBooking()`           | Rimozione solo se `status === 'draft'`                      |
| `rescheduleBooking()` 🔧    | (da creare) cambia `start`, `end`, `lastRescheduledAt`      |
| `getBookingById()`          | Ottieni un booking specifico                               |
| `getBookingsByClient(uid)`  | Stream reattivo delle prenotazioni di un cliente            |
| `getBookingsByDay(date)`    | Tutte le prenotazioni in una data specifica                 |
| `getAllBookings()`          | Tutte le prenotazioni (admin only)                         |
| `watchBooking(id)`          | Observer singolo per sync real-time                         |
| `getTotalRevenueThisMonth()`| Calcola guadagno mensile da `paid` bookings                |


## 📎 Esempio Booking completo (RTDB/Firebase)

```json
{
  "id": "bk123",
  "idClient": "usr45",
  "idArtist": "tat9",
  "title": "Tattoo schiena",
  "description": "Fenice a colori",
  "start": "2025-07-21T10:00:00Z",
  "end": "2025-07-21T13:00:00Z",
  "status": "on-going",
  "price": 15000,
  "paidAmount": 5000,
  "createAt": "2025-07-01T10:00:00Z",
  "updateAt": "2025-07-19T12:00:00Z",
  "rescheduleCount": 1,
  "lastRescheduledAt": "2025-07-18T08:00:00Z"
}
```


## 📊 7. Matrice delle azioni per ruolo e stato

| Stato         | Azione                              | Client           | Admin/Staff      | Metodo usato            |
|---------------|-------------------------------------|------------------|------------------|--------------------------|
| `draft`       | Compila / modifica                  | ✅               | ✅               | `updateBooking()`       |
| `draft`       | Annulla                             | ✅               | ✅               | `setStatus('cancelled')`|
| `draft`       | Paga acconto                        | ✅               | 🔒 no            | `setStatus('paid')`     |
| `paid`        | Richiesta cambio data               | 🟡 richiede      | ✅ modifica      | `updateBooking()`       |
| `paid`        | Annullamento                        | ❌               | ✅               | `setStatus('cancelled')`|
| `on-going`    | Visualizza                          | ✅               | ✅               | -                        |
| `on-going`    | Conclude sessione                   | ❌               | ✅               | `setStatus('completed')`|
| `completed`   | Lascia recensione                   | ✅               | 🔍 visualizza    | `ReviewService.add()`   |
| `completed`   | Genera fattura                      | ❌               | ✅               | `InvoiceService.create()`|
| `cancelled`   | Visualizza storico                  | ✅               | ✅               | -                        |


## 🔒 8. Validazioni e sicurezza

| Azione              | Validazione necessaria                      |
|---------------------|---------------------------------------------|
| `setStatus()`       | Controllo transizione valida                |
| `updateBooking()`   | Solo su `draft` o previa autorizzazione     |
| `deleteBooking()`   | Solo se `status === 'draft'`                |
| `rescheduleBooking()` | Solo da admin o con richiesta formale     |
| `addDraft()`        | `auth.uid === idClient`                     |

## 🔔 9. Eventi automatici (notifiche/azioni sistema)

| Trigger                            | Azione                                         |
|------------------------------------|------------------------------------------------|
| `booking.status === 'paid'`        | Reminder 24h prima dell’orario (`start`)       |
| `booking.status === 'completed'`   | Richiesta recensione                          |
| `setStatus('cancelled')`           | Invia email/WhatsApp                          |
| `rescheduleBooking()`              | Invia nuova conferma                          |
| `addDraft()`                       | Notifica allo studio                          |

## ➕ 10. Estensioni future (già supportabili)

| Funzionalità              | Dettagli                                                                 |
|---------------------------|--------------------------------------------------------------------------|
| Multisessione             | Booking master con figli `subBookingIds[]`                               |
| Allegati (ref, immagini)  | `attachments?: string[]`                                                 |
| Firma digitale            | `clientSignatureUrl?: string`                                            |
| Deposito carta (Stripe)   | Uso di `paymentIntentId` + `status === awaiting_payment`                 |
| Chat integrata            | Tab conversazione legata a `bookingId`                                   |
| Storico stato (`history`) | Array di `{status, changedAt, changedBy}` per tracciamento               |
