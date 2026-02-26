# Admin 02 - Runbook Amministratore

## Apertura giornata (10 min)
1. controlla `/admin/calendar`
2. apri notifiche e segna priorita
3. verifica booking `pending`/`confirmed`
4. controlla ticket in `/admin/messaging`
5. verifica disponibilita staff attivo

## Gestione prenotazioni
- booking `draft/pending`: verificare completezza e pagamenti
- booking `confirmed/paid`: pianificare sessioni e note operative
- booking `in_progress/completed`: chiudere attività e follow-up
- evitare modifiche manuali fuori flusso applicativo

## Gestione utenti e ruoli
- route: `/admin/users`, `/admin/staff`, `/admin/permissions`
- prima di cambiare ruolo admin, verificare che resti almeno 1 admin visibile
- per staff, validare permessi granulari coerenti con mansione

## Gestione incidenti comuni
### Pagamento non confermato
1. verificare booking e payment intent in backend/log
2. non forzare `paid` senza evidenza transazione
3. aprire ticket tecnico se mismatch persistente

### Utente non accede
1. verificare presenza profilo `users/{uid}`
2. verificare ruolo e `isActive/isVisible`
3. verificare eventuali errori permission-denied

### Messaggi non visibili
1. verificare partecipanti conversazione
2. controllare path `userConversations` e `conversationMessages`
3. verificare rules per ruolo corrente

## Chiusura giornata
1. rivedere agenda domani
2. chiudere ticket aperti o assegnarli
3. allineare eventuali booking incompleti
4. annotare anomalie per il team tecnico
