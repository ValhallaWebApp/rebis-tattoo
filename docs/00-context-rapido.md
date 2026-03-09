# 00 - Context Rapido

Obiettivo: trovare il contesto giusto in meno di 2 minuti.

## Partenza rapida
1. Leggi `docs/01-architettura-frontend.md` per capire struttura e routing.
2. Leggi `docs/08-stato-progetto-e-cosa-fatto.md` per stato reale e debito tecnico.
3. Leggi `docs/05-interfacce-e-contratti.md` per modelli e contratti tra feature/service.
4. Leggi `docs/02-catalogo-servizi.md` per mappa servizi core.
5. Vai direttamente ai file codice della feature che devi toccare.

## Mappa codice (entrypoint affidabili)
- Routing/app shell:
  - `src/app/app.routes.ts`
  - `src/app/app.config.ts`
  - `src/main.ts`
- Core domain:
  - `src/app/core/services/**`
  - `src/app/core/models/**`
  - `src/app/core/guards/**`
- Feature verticali:
  - `src/app/features/public/**`
  - `src/app/features/clients/**`
  - `src/app/features/admin/**`
  - `src/app/features/calendar/**`

## Se cerchi subito una responsabilita
- Auth/ruoli/permessi:
  - `src/app/core/services/auth/auth.service.ts`
  - `src/app/core/services/users/user.service.ts`
  - `src/app/core/guards/*.guard.ts`
- Booking/calendario/sessioni:
  - `src/app/core/services/bookings/booking.service.ts`
  - `src/app/core/services/session/session.service.ts`
  - `src/app/features/calendar/**`
- Pagamenti:
  - `src/app/core/services/payments/payment-api.service.ts`
  - `src/app/shared/components/stripe-payment/stripe-payment.component.ts`
- Messaging/chatbot:
  - `src/app/core/services/messaging/messaging.service.ts`
  - `src/app/core/services/chatBot/chat-bot.service.ts`
  - `src/app/core/services/chatBot/local-llm.service.ts`

## Cache locali utili (.codex)
Nel root progetto ci sono file di supporto per orientamento veloce:
- `.codex_filelist.txt`, `.codex_src_files.txt`
- `.codex_services_index.json`, `.codex_service_public_methods.json`
- `.codex_components.txt`, `.codex_features.txt`
- `.codex_docs_snippets.txt`

Nota: usa questi file come indice rapido, ma in caso di dubbio il codice sorgente resta la fonte di verita.

## Workflow consigliato per analisi/modifiche
1. Parti dal route o componente UI coinvolto.
2. Risali al service core chiamato dalla feature.
3. Verifica modello/contratto in `core/models`.
4. Controlla guard/permessi se il flusso e protetto.
5. Cerca test spec esistenti nella stessa area prima di cambiare codice.
