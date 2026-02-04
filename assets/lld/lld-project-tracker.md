# LLD - Project Tracker

## 1) ViewModel (vm$)
### Input
- projectId from route
- projects (getProjectById)
- bookings (getAllBookings)
- sessions (getAll)
- staff map
- client map

### Output
- project, booking, sessions[]
- artistName, clientName
- paidTotal, expectedTotal, remaining
- flags: loading, notFound

### Normalizzazioni
- normalizeLocalDateTime for start/end
- session status: `done` -> `completed`
- session list sorted by ISO start
- fallback projectId from bookingId when missing

## 2) Actions & Handlers
### Progetto
- `setProjectStatus(status)` -> ProjectsService.updateProject
- `editProject()` -> open dialog / inline edit (title, zone, notes)

### Booking
- `createBookingForProject()` -> open Calendar Drawer in booking mode
- `editBooking(booking)` -> open Calendar Drawer edit

### Sessioni
- `addSession()` -> open Calendar Drawer in session mode
- `editSession(session)` -> open Calendar Drawer edit
- `setSessionStatus(session, status)` -> SessionService.update + dialog decision if completed
- `setSessionPaid(session, amount)` -> SessionService.update(paidAmount)

## 3) UI Components
### Top Bar
- Back to Project Manager
- Primary action: Add Session
- Secondary: Create Booking (if missing)

### Hero
- Status chip + quick status change menu
- KPI: booking present, sessions count, paid, remaining

### Booking Box
- Show booking data
- CTA: Edit / Create

### Sessions Box
- List rows with: date, status, duration, paidAmount
- Row actions: edit, status menu

### Client Box (optional add)
- Show client name, email, phone
- Buttons: Open client, Message

## 4) Validations
- Prevent session date earlier than last session in project
- Prevent sessionNumber decrease
- If project missing: block session actions

## 5) Routing
- Project Manager: `/admin/project-manager`
- Project Page: `/admin/portfolio/:id`
- Client: `/admin/clients?query=...`

## 6) Error handling
- SnackBar for failed updates
- Confirm dialog on destructive actions

## 7) Testing checklist
- Project without booking
- Project with booking + sessions
- Session with status completed
- Session with legacy status `done`
- Client lookup missing
