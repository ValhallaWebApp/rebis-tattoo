# Checklist Logiche Progetto

## Sicurezza regole RTDB
- [x] Bloccare escalation privilegi su `users/{uid}` (self-write limitato, role non elevabile).
- [x] Bloccare hijack ownership su `bookings/{id}` e `sessions/{id}` (owner fields immutabili per non-admin/staff).
- [x] Limitare write su `reviews` a proprietario recensione o admin/staff.
- [x] Chiudere completamente `bonus` con redeem via backend privilegiato e rules path-specific.

## Coerenza dati dominio
- [x] Correggere consistenza `booking <-> project` su attach/detach (evitare stati parziali).
- [x] Correggere `detachBookingIfMatch` con rimozione effettiva campo `bookingId`.

## Messaggistica
- [ ] Allineare permessi UI client su chiusura/riapertura conversazione.
- [ ] Definire assegnazione partecipanti staff nelle nuove conversazioni.

## Affidabilita frontend
- [ ] Eliminare leak subscribe nel calendario admin (`takeUntilDestroyed` / `OnDestroy`).
