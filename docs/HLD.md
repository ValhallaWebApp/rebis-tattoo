# HLD — REBIS Secure Platform (FASE 1)

## Componenti
- Web App: Next.js (App Router) per UI pubblica e dashboard
- Core API: servizi dominio (booking/project/session) + audit
- Payment Service: Stripe intent + webhook idempotente
- PostgreSQL: source of truth (domini + audit + payment_events)

## Domini (bounded contexts)
- Booking: consulenze prenotabili dal cliente (pubblico)
- Project: gestione lavoro (admin)
- Session: sedute collegate al project (admin)
- Payment: transazioni Stripe + riconciliazione webhook

## Flussi rete (testuali)
1) Prenotazione consulenza
Client -> Web -> Core API -> PostgreSQL
2) Pagamento deposito
Client -> Web -> Payment Service -> Stripe
Stripe -> Payment Service (webhook) -> PostgreSQL -> Core API (update stato)
3) Dashboard admin
Admin -> Web -> Core API -> PostgreSQL

## Sicurezza baseline
- Auth + ruoli (client/admin/staff)
- RBAC applicativo sulle route
- Webhook Stripe: signature verification + idempotenza (payment_events)
- Audit log per azioni critiche
