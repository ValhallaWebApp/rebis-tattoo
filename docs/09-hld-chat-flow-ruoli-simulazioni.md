# 09 - HLD Chat: Flow, Ruoli e Simulazioni

## Scope reale
Il progetto ha due canali chat distinti:
1. chatbot assistente (UI globale popup)
2. messaging operativa ticket (cliente/staff/admin)

## 1) Chatbot assistente
Componenti principali:
- `shared/components/chat-bot/chat-bot.component.ts`
- `core/services/chatBot/chat-bot.service.ts`
- `core/services/chatBot/local-llm.service.ts`
- `core/services/chatBot/local-llm.worker.ts`

Persistenza:
- locale browser (`localStorage`) con chiave `rebis.chat.front.v1`
- indice guest identity in localStorage

Flow:
1. utente invia messaggio
2. `ChatService.replyWithPlan(...)` prepara contesto
3. `LocalLlmService` prova generazione via worker
4. fallback safe se modello non disponibile/timeout
5. output + chips suggerite (`Accedi`, `Apri booking`, `Vai al profilo`)

## 2) Messaging ticket
Service: `core/services/messaging/messaging.service.ts`

Nodi RTDB:
- `conversations/{id}`
- `conversationMessages/{conversationId}/{messageId}`
- `userConversations/{uid}/{conversationId}`

Flow base:
1. lista conversazioni per utente
2. stream messaggi conversazione
3. invio messaggio con update unread counters
4. notifica destinatari
5. mark-as-read / archive conversazione

## Ruoli e accesso
- `client`: accede alle proprie conversazioni
- `staff`: accesso solo a conversazioni dove e partecipante
- `admin`: accesso completo backoffice
- `guest/public`: solo chatbot locale, nessun ticket protetto

## Simulazioni utili
### A - Guest chiede prenotazione
- bot risponde e propone azioni
- conferma operativa richiede login

### B - Client apre ticket
- crea/usa conversazione esistente
- invia messaggio
- staff/admin ricevono notifica

### C - Staff non assegnato prova accesso
- servizio blocca con errore autorizzazione

## Rischi da monitorare
- performance primo avvio LLM locale (warmup modello)
- allineamento rules RTDB con path realmente usati
- fallback UX quando notifiche cross-user vengono negate
