# HLD - Project Tracker

## Obiettivo
Rendere il Project Tracker (progetto singolo) uno strumento completo per l’admin, con tutte le azioni operative sul progetto, booking, sessioni e cliente, in coerenenza con i servizi esistenti.

## Contesto
- Feature: `src/app/features/admin/components/project-tracker`
- Data sources: ProjectsService (RTDB), BookingService (RTDB), SessionService (RTDB), ClientService (Firestore), StaffService
- Stili: Angular Material + SCSS custom
- Stato progetto: `draft | scheduled | active | healing | completed | cancelled`

## Scope
### In scope
- Azioni admin complete dal tracker
- Normalizzazione dati e mapping coerente
- UI action bar + menu contestuali
- Guardrail su coerenza (sessioni/booking)

### Out of scope
- Pagamenti avanzati (fatture PDF)
- Workflow cliente pubblico

## Azioni richieste (funzionali)
### Progetto
1. Cambia stato progetto (draft/scheduled/active/healing/completed/cancelled)
2. Modifica titolo, zona, note
3. Apri progetto nel Project Manager

### Booking
1. Apri/modifica booking collegata
2. Crea booking se assente
3. Collegamento projectId/bookingId coerente

### Sessioni
1. Aggiungi sessione (drawer)
2. Modifica sessione
3. Cambia status sessione
4. Modifica paidAmount sessione
5. Regole coerenza: numero sessione e ordine temporale

### Cliente
1. Apri scheda cliente
2. Messaggia (WhatsApp/email)

## UX / UI (alto livello)
- Top bar con azioni principali
- Hero card con status e KPI
- Sezione booking con CTA “Crea/Modifica”
- Sezione sessioni con menu per riga
- Sezione cliente con accesso rapido

## Regole chiave
- Se sessione completed: blocco campi data/ora/durata
- Se sessione non è ultima del progetto: blocco campi sensibili
- Nuova sessione deve iniziare dopo l’ultima esistente
- Status legacy sessione `done` mappato a `completed`

## Dipendenze
- Calendar drawer / session editing
- Project Manager (link back)
- Services: ProjectsService, BookingService, SessionService

## Rischi
- Dati legacy con date in formato diverso (Z vs locale)
- Sessioni senza projectId (serve fallback via bookingId)

## Output
- Tracker completo e azionabile senza uscire dalla pagina
