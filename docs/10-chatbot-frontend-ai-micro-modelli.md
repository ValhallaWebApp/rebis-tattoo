# 10 - Chatbot Frontend-Only e Micro Modelli AI

## Obiettivo
Definire una strategia chat 100% frontend (senza backend chat dedicato) e suggerire micro-modelli AI integrabili in browser.

## Architettura Frontend-Only

### Componenti
- `src/app/shared/components/chat-bot/chat-bot.component.ts`
- `src/app/core/services/chatBot/chat-bot.service.ts`
- `src/app/core/services/bookings/booking.service.ts`

### Flow runtime
1. Utente apre popup chat.
2. Il client crea/riusa una chat locale con chiave identita (utente autenticato o guest locale).
3. I messaggi vengono salvati in `localStorage` (frontend state persistente browser-side).
4. `ChatService.replyWithPlan(...)` esegue planner locale:
   - intent detection
   - estrazione entita (data, orario, artista)
   - step guidato con chips
5. Solo se i dati sono completi e l utente conferma, il planner emette `action: booking-draft`.
6. Il componente:
   - se non autenticato blocca la conferma e propone `Accedi`
   - se autenticato crea la bozza in booking (`BookingService.addDraftFromChat`).

## Ruoli (chat flow)

| Ruolo | Uso chat | Persistenza chat | Conferma bozza prenotazione |
|---|---|---|---|
| Guest | Si | `localStorage` locale | No, richiede login |
| Client autenticato | Si | `localStorage` locale | Si |
| Staff/Admin | Si | `localStorage` locale | Si (se usa il popup chat) |

## Simulazioni rapide

### Simulazione A - Guest
- Input: "prenota domani alle 15 con marco"
- Output bot: richiesta conferma bozza
- Click: "Conferma prenotazione"
- Esito: blocco creazione bozza + chips `Accedi`

### Simulazione B - Client autenticato
- Input: "prenota domani alle 15 con sara"
- Output bot: riepilogo + richiesta conferma
- Click: "Conferma prenotazione"
- Esito: creazione bozza booking (`source=chat-bot`)

### Simulazione C - Dati incompleti
- Input: "voglio prenotare"
- Output bot: richiesta campi mancanti (data/orario/artista) con chips guida

## Micro modelli AI consigliati (frontend)

### 1) Generazione chat locale (LLM piccolo)
- `Qwen/Qwen2.5-1.5B-Instruct`
- `HuggingFaceTB/SmolLM2-1.7B-Instruct`

Uso consigliato:
- device moderni: WebGPU
- fallback: quantizzato su WASM/CPU

### 2) Embeddings per memoria semantica e RAG leggero
- `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (multilingua, leggero)
- `BAAI/bge-small-en-v1.5` (molto compatto per retrieval EN)

### 3) Runtime lato browser
- `@huggingface/transformers` (Transformers.js) per inferenza in browser
- `mlc-ai/web-llm` per chat LLM on-device ad alte prestazioni WebGPU

## Strategia integrazione consigliata

1. Fase 1 (gia pronta): planner rule-based locale + chips guidate.
2. Fase 2: aggiungi embeddings locali per retrieval FAQ/servizi.
3. Fase 3: aggiungi mini-LLM on-device per risposte naturali, mantenendo guardrail su azioni business (`booking-draft` sempre validato da regole deterministiche).

## Implementazione effettiva (stato corrente)

- Dipendenze aggiunte:
  - `@huggingface/transformers`
  - `onnxruntime-web`
- Nuovo servizio:
  - `src/app/core/services/chatBot/local-llm.service.ts`
  - modello: `onnx-community/Qwen2.5-0.5B-Instruct`
  - load lazy, timeout generazione, fallback automatico rule-based
- Integrazione planner:
  - `src/app/core/services/chatBot/chat-bot.service.ts`
  - `replyWithPlan(chatId, history, { role })` usa LLM locale per assistenza generale
  - prenotazione resta deterministica (guardrail)
- Passaggio ruolo dal componente:
  - `src/app/shared/components/chat-bot/chat-bot.component.ts`

## Note operative

- Al primo utilizzo il browser scarica i pesi modello (latenza iniziale alta).
- Se WebGPU non e disponibile, il runtime passa a WASM (piu lento).
- Se il modello non parte o va in timeout, il chatbot continua in fallback rule-based senza bloccare la UX.
