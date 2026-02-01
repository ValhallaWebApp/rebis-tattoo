# REBIS Secure Platform — Project Charter (FASE 0)

## Visione
Piattaforma studio tatuaggi: booking consulenze (pubblico), gestione progetti/sedute (admin), pagamenti Stripe, deploy Docker+K8s, sicurezza Zero Trust.

## MVP (Definition of Done)
- Booking consulenza: slot valido, no overlap, no date passate.
- Admin: calendario + presenze + lifecycle Booking → Project → Session.
- Pagamenti: deposito Stripe + webhook idempotente + stato coerente.
- Deploy lab: namespace + deploy + service + ingress su Kubernetes.
- Audit log azioni critiche + test minimi (scheduling + webhook + lifecycle).

## In scope
Next.js (App Router), Node.js services, PostgreSQL, Docker, Kubernetes, RBAC/NetworkPolicy.

## Out of scope (non ora)
Mobile app, multi-tenant completo, realtime avanzato, AI preventivi.
