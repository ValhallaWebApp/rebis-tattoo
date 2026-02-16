# Dataset Test Pulito (RTDB + Firestore)

## File aggiornati
- `firebase-rtdb-export.mock.safe.json`
- `firebase-rtdb-export.mock.json`
- `firestore-users.mock.json`
- `firebase-unified.mock.json`

## Utenti test
- `admin`:
  `uid=Nhmp6AN2ehPksUbP4mlCskNirA83`, `email=valhallawebapp@gmail.com`
- `staff`:
  `uid=stf_test_01`, `email=staff.test@rebistattoo.it`, `permissions.canManageRoles=true`
- `client`:
  `uid=cli_test_01`, `email=cliente.test@rebistattoo.it`

## Casistiche coperte
- Booking status:
  `draft`, `pending`, `confirmed`, `paid`, `in_progress`, `completed`, `cancelled`, `no_show`
- Session status:
  `planned`, `completed`, `cancelled`
- Project status:
  `scheduled`, `active`, `completed`, `cancelled`, `healing`
- Invoices:
  `pending`, `paid`, `cancelled`
- Messaging:
  conversazione cliente/staff/admin con messaggi
- Bonus:
  promo code, redeem, wallet, ledger

## Pulizia ridondanze applicata
- Rimossi dai booking i duplicati legacy:
  `idClient`, `idArtist`, `createAt`, `updateAt`, `description`
- Mantenuti i campi canonici booking:
  `clientId`, `artistId`, `createdAt`, `updatedAt`, `notes`
- Progetti mantenuti senza alias legacy (`genere`, `copertine` rimossi).

## Import RTDB
Comando:

```powershell
npm run db:import:mock
```

Se fallisce per credenziali:

```powershell
firebase login --reauth
```

poi rieseguire l'import.
