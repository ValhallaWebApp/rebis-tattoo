# FASE 2 — API Contract (Scheduling)

## GET /api/availability
Query:
- staffId
- from (YYYY-MM-DD)
- to (YYYY-MM-DD)
- duration (minutes)
- step (minutes, default 15)

Response 200:
- timezone
- staffId
- durationMinutes
- stepMinutes
- days[] { date, slots[] { start, end } }

## POST /api/holds
Body:
- staffId
- start (ISO with tz)
- end (ISO with tz)
- clientId (optional)
- ttlSeconds (default 600)

Response 201:
- token
- expiresAt

Errors:
- 409 SLOT_NOT_AVAILABLE

## POST /api/bookings/confirm
Body:
- holdToken
- notes (optional)
- contact (email/phone)

Response 201:
- bookingId
- status

Errors:
- 410 HOLD_EXPIRED
- 409 SLOT_NOT_AVAILABLE

## POST /api/holds/release
Body:
- holdToken
Response 204
