# HLD - Sistema Notifiche

## Obiettivo
Introdurre un sistema notifiche reale, persistente e scalabile per utenti client/admin/artisti, sostituendo i dati statici in UI e riducendo no-show, ritardi operativi e messaggi persi.

## Contesto
- Frontend: Angular 18 + Angular Material
- Auth: Firebase Auth
- Dati: RTDB (booking/session/project), Firestore (user profile)
- UI esistente: campanella in `src/app/app.component.*` + snackBar locali

## Scope
### In scope
- Notifiche in-app persistenti (badge + lista)
- Marcatura lette/non lette
- Generazione notifiche da eventi core (booking/chat/pagamenti)
- Routing rapido dalla notifica alla schermata target

### Out of scope (fase successiva)
- Push native mobile
- Motore campagne marketing avanzato
- Template multilingua dinamici lato backoffice

## Attori
- Cliente: riceve reminder, aggiornamenti booking, messaggi studio
- Admin/Artista: riceve nuove prenotazioni, cancellazioni, nuovi messaggi
- Sistema: produce notifiche tecniche e informative

## Casi d'uso prioritari
1. Nuova prenotazione creata
2. Prenotazione modificata/cancellata
3. Reminder appuntamento (24h, 2h)
4. Nuovo messaggio in conversazione
5. Conferma/richiesta pagamento o acconto

## Architettura (alto livello)
1. `NotificationService` frontend:
- Query notifiche utente
- Conteggio unread
- `markAsRead`, `markAllAsRead`

2. Storage notifiche:
- RTDB path: `notifications/{userId}/{notificationId}`
- Motivazione: coerenza con servizi realtime gia presenti su booking/session

3. Event producers:
- BookingService (create/update/cancel/status)
- Messaging module (new inbound message)
- Payment flow (deposit/paid state change)

4. UI consumers:
- `AppComponent` campanella globale
- eventuale pagina archivio notifiche con filtro tipo/stato

## Modello logico notifica
- `id`
- `userId`
- `type` (`booking|chat|payment|system`)
- `title`
- `message`
- `link` (route interna)
- `createdAt`
- `readAt` (null se non letta)
- `priority` (`low|normal|high`)

## Requisiti non funzionali
- Realtime < 2s su nuovi eventi
- Badge sempre coerente con unread lato DB
- Idempotenza minima su eventi ripetuti (dedupe semplice su chiave evento+timestamp)
- Fallback sicuro: se notifica fallisce, workflow principale non deve rompersi

## Sicurezza
- Accesso consentito solo al proprietario `userId` o ruoli admin autorizzati
- Nessun dato sensibile in chiaro nel testo notifica
- Rules RTDB con validazione campi minimi

## Strategia di rollout
1. Fase 1: in-app persistente + eventi booking/chat
2. Fase 2: reminder schedulati (Cloud Functions/cron)
3. Fase 3: push browser con FCM e preferenze utente

## Rischi
- Doppie notifiche da trigger multipli non coordinati
- Legacy data inconsistente su booking status/date
- Rumore eccessivo senza regole di priorita/frequenza

## Output atteso
- Campanella globale alimentata da dati reali
- Eventi core coperti con notifica persistente
- Base pronta per estensione push/email
