
---

## Validazione (Lab)
Schema applicato su PostgreSQL (Docker) e verificato con `\dt`.

Tabelle presenti:
- users
- staff_profiles
- availability_rules
- bookings
- booking_holds
- projects
- sessions
- payments
- payment_events
- audit_log

Comandi usati:
- `psql ... -f infra/scripts/001_init.sql`
- `psql ... -c "\dt"`
