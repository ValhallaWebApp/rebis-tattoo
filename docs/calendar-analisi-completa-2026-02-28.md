# Analisi Completa Calendar + Core Models

Data: 2026-02-28 11:56:39

Skill usate (locali progetto): angular-component, angular-routing, angular-signals, angular-testing.

## Perimetro
- files calendario feature: 63
- files calendar-v2 shared: 35
- files calendar-admin: 4
- files core/models: 13
- totale file analizzati: 115

## File-by-file
### src/app/core/models/api/payment-bridge.dto.ts
- tipo: .ts | righe: 46
- export: PaymentCurrencyDto, NotificationPriorityDto, CreatePaymentIntentRequestDto, CreatePaymentIntentResponseDto, NotificationCreateRequestDto, NotificationCreateResponseDto, StaffSyncProfileRequestDto, StaffSyncProfileResponseDto, BonusRedeemRequestDto, BonusRedeemResponseDto
- interfacce: CreatePaymentIntentRequestDto, CreatePaymentIntentResponseDto, NotificationCreateRequestDto, NotificationCreateResponseDto, StaffSyncProfileRequestDto, StaffSyncProfileResponseDto, BonusRedeemRequestDto, BonusRedeemResponseDto
- type alias: PaymentCurrencyDto, NotificationPriorityDto
- ruolo: contratto dominio condiviso tra services/componenti.

### src/app/core/models/booking.model.ts
- tipo: .ts | righe: 45
- export: BookingStatus, BookingChatDraft, Booking
- interfacce: BookingChatDraft, Booking
- type alias: BookingStatus
- ruolo: contratto dominio condiviso tra services/componenti.

### src/app/core/models/calendar.model.ts
- tipo: .ts | righe: 8
- export: CalendarEvent
- interfacce: CalendarEvent
- ruolo: contratto dominio condiviso tra services/componenti.

### src/app/core/models/chat.model.ts
- tipo: .ts | righe: 13
- export: ChatMessage, ChatThread
- interfacce: ChatMessage, ChatThread
- ruolo: contratto dominio condiviso tra services/componenti.

### src/app/core/models/client.model.ts
- tipo: .ts | righe: 9
- export: Client
- interfacce: Client
- ruolo: contratto dominio condiviso tra services/componenti.

### src/app/core/models/common.model.ts
- tipo: .ts | righe: 4
- export: Timestamped
- interfacce: Timestamped
- ruolo: contratto dominio condiviso tra services/componenti.

### src/app/core/models/invoice.model.ts
- tipo: .ts | righe: 11
- export: Invoice
- interfacce: Invoice
- ruolo: contratto dominio condiviso tra services/componenti.

### src/app/core/models/messaging.model.ts
- tipo: .ts | righe: 25
- export: ConversationStatus, MessageKind, ParticipantRole, Conversation, ConversationMessage
- interfacce: Conversation, ConversationMessage
- type alias: ConversationStatus, MessageKind, ParticipantRole
- ruolo: contratto dominio condiviso tra services/componenti.

### src/app/core/models/notification.model.ts
- tipo: .ts | righe: 14
- export: NotificationType, NotificationPriority, AppNotification
- interfacce: AppNotification
- type alias: NotificationType, NotificationPriority
- ruolo: contratto dominio condiviso tra services/componenti.

### src/app/core/models/project.model.ts
- tipo: .ts | righe: 21
- export: ProjectStatus, Project
- interfacce: Project
- type alias: ProjectStatus
- ruolo: contratto dominio condiviso tra services/componenti.

### src/app/core/models/service.model.ts
- tipo: .ts | righe: 8
- export: TattooService
- interfacce: TattooService
- ruolo: contratto dominio condiviso tra services/componenti.

### src/app/core/models/staff-member.model.ts
- tipo: .ts | righe: 8
- export: StaffMember
- interfacce: StaffMember
- ruolo: contratto dominio condiviso tra services/componenti.

### src/app/core/models/user.model.ts
- tipo: .ts | righe: 38
- export: UserRole, UserPermissions, AppUser
- interfacce: UserPermissions, AppUser
- type alias: UserRole
- ruolo: contratto dominio condiviso tra services/componenti.

### src/app/features/admin/components/calendar-admin/calendar-admin.component.html
- tipo: .html | righe: 0
- template metrics: ngIf=0, ngFor=0, forms=0, material=0, buttons=0, dialogRefs=0

### src/app/features/admin/components/calendar-admin/calendar-admin.component.scss
- tipo: .scss | righe: 116
- style metrics: cssVars=0, classBlocks=13, mediaQueries=1, ngDeep=1

### src/app/features/admin/components/calendar-admin/calendar-admin.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./calendar-admin.component
- metodi: describe, beforeEach, it, expect
- suites: CalendarAdminComponent
- test: should create

### src/app/features/admin/components/calendar-admin/calendar-admin.component.ts
- tipo: .ts | righe: 520
- export: CalendarEvent, CalendarAdminComponent
- selector: app-calendar-admin
- standalone: true
- interfacce: CalendarEvent
- import locali: ../../../../core/modules/material.module, ../../../calendar/calendar.component, ../../../../core/services/bookings/booking.service, ../../../../core/services/session/session.service, ../../../../core/services/staff/staff.service, ../../../../core/services/auth/auth.service
- metodi: trigger, transition, style, animate, log, group, table, sanityCheck, takeUntilDestroyed, onCleanup, ngOnInit, buildFormForType, onSelectedTypeChanged, mapBookingToEvent, mapSessionToEvent, handleBooking, handleUpdateEvent, updateEventInList, pad, formatLocal, normalizeLocalDateTime, addMinutesLocal, buildStartFromDateTime

### src/app/features/calendar/availability.service.ts
- tipo: .ts | righe: 77
- export: AvailabilityQueryBase, AvailabilityService
- interfacce: AvailabilityQueryBase
- import locali: ./models, ./utils
- metodi: getAvailableTimesByDate, getAvailableDatesByTime
- ruolo: calcolo disponibilita (date e slot) per artista/agenda.

### src/app/features/calendar/calendar.component.html
- tipo: .html | righe: 7
- template metrics: ngIf=0, ngFor=0, forms=0, material=0, buttons=0, dialogRefs=0

### src/app/features/calendar/calendar.component.scss
- tipo: .scss | righe: 4
- style metrics: cssVars=0, classBlocks=0, mediaQueries=0, ngDeep=0

### src/app/features/calendar/calendar.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./calendar.component
- metodi: describe, beforeEach, it, expect
- suites: CalendarComponent
- test: should create

### src/app/features/calendar/calendar.component.ts
- tipo: .ts | righe: 517
- export: CalendarComponent
- selector: app-calendar-admin-v2
- standalone: true
- import locali: ./calendar-shell/calendar-shell.component, ./models, ../../core/services/staff/staff.service, ../../core/services/bookings/booking.service, ../../core/services/session/session.service, ../../core/modules/material.module, ../../core/services/ui/ui-feedback.service, ../../core/services/projects/projects.service
- metodi: rebuildEvents, buildEndFromStart, diffMinutes, formatLocal, onCreateRequested, onUpdateRequested, String, delete, showOpError, hasConflict, findEventById, changedAtMinutePrecision, showConflictMessage, validateSessionSequence

### src/app/features/calendar/calendar.service.spec.ts
- tipo: .ts | righe: 12
- import locali: ./calendar.service
- metodi: describe, beforeEach, it, expect
- suites: CalendarService
- test: should be created

### src/app/features/calendar/calendar.service.ts
- tipo: .ts | righe: 173
- export: CalendarView, CalendarEvent, CalendarService
- interfacce: CalendarEvent
- type alias: CalendarView
- metodi: shareReplay, setView, setDate, setEvents, add, update, remove, next, prev, shift, toLocalDateKey, startOfWeekMonday, computeVisibleDays, groupByArtist, formatTitle
- ruolo: stato calendario (view/date/events) e navigazione temporale.

### src/app/features/calendar/calendar-shell/calendar-shell.component.html
- tipo: .html | righe: 101
- template metrics: ngIf=6, ngFor=1, forms=0, material=24, buttons=8, dialogRefs=0

### src/app/features/calendar/calendar-shell/calendar-shell.component.scss
- tipo: .scss | righe: 117
- style metrics: cssVars=0, classBlocks=27, mediaQueries=2, ngDeep=2

### src/app/features/calendar/calendar-shell/calendar-shell.component.spec.ts
- tipo: .ts | righe: 57
- import locali: ./calendar-shell.component, ../../../core/services/ui/ui-feedback.service, ../../../core/services/clients/client.service, ../../../core/services/projects/projects.service, ../../../core/services/session/session.service, ../../../core/services/auth/auth.service
- metodi: describe, beforeEach, it, expect
- suites: CalendarShellComponent
- test: should create

### src/app/features/calendar/calendar-shell/calendar-shell.component.ts
- tipo: .ts | righe: 1161
- export: CalendarShellComponent
- selector: app-calendar-shell
- standalone: true
- import locali: ../models, ../utils, ../views/day-view/day-view.component, ../views/week-resource/week-resource/week-resource.component, ../views/month-view/month-view.component, ../drawer/event-drawer/event-drawer.component, ../../../core/modules/material.module, ../../../shared/components/dialogs/confirm-dialog/confirm-dialog.component, ../../../core/services/ui/ui-feedback.service, ../dialogs/create-project-dialog/create-project-dialog.component, ../dialogs/complete-session-dialog/complete-session-dialog.component, ../../../core/services/clients/client.service, ../../../core/services/projects/projects.service, ../../../core/services/auth/auth.service, ../../../core/services/session/session.service
- metodi: ngOnChanges, ngOnInit, queueMicrotask, bindDrawerRouteActions, consumePendingDrawerRouteAction, clearDrawerRouteParams, preloadDrawerLists, setView, goPrev, goNext, goToday, onArtistsChipChange, onToolbarNew, openDayFromWeekCell, openDayFromMonth, openCreateFromDay, openCreateBookingFromProject, openEditEvent, openCreateSessionFromBooking, openCreateSessionFromProject, computeNextSessionSeed, onDrawerClosed, onDrawerSubmit, onDayAction, getBackofficeBase, askCompleteSessionDecision, applyCompleteSessionDecision, toSeedFromEvent, rebuildBookingsLite, hydrateAutocompleteFallbacksFromEvents, buildFallbackClientsFromEvents, mergeClientsLite, mergeProjectsLite, extractProjectLabelFromEvent, extractClientLabelFromEvent, mapActionToStatus, confirmCancel, confirmOpenProject, openCreateProjectDialog, onCreateProjectRequested, String, userCanManageProjects, canCreateProjectForAssignedBookingFromDrawer, canStaffCreateProjectForBooking, confirmProjectOverride, createProjectAndAssign, diffMinutes, toLocalDateTime, normalizeSeedDateTime

### src/app/features/calendar/dialogs/availability-sheet/availability-sheet/availability-sheet.component.html
- tipo: .html | righe: 59
- template metrics: ngIf=4, ngFor=3, forms=0, material=8, buttons=4, dialogRefs=0

### src/app/features/calendar/dialogs/availability-sheet/availability-sheet/availability-sheet.component.scss
- tipo: .scss | righe: 69
- style metrics: cssVars=0, classBlocks=14, mediaQueries=1, ngDeep=0

### src/app/features/calendar/dialogs/availability-sheet/availability-sheet/availability-sheet.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./availability-sheet.component
- metodi: describe, beforeEach, it, expect
- suites: AvailabilitySheetComponent
- test: should create

### src/app/features/calendar/dialogs/availability-sheet/availability-sheet/availability-sheet.component.ts
- tipo: .ts | righe: 86
- export: AvailabilitySheetData, AvailabilitySheetResult, AvailabilitySheetComponent
- selector: app-availability-sheet
- standalone: true
- interfacce: AvailabilitySheetData, AvailabilitySheetResult
- import locali: ../../../availability.service, ../../../models, ../../../utils, ../../../../../core/modules/material.module
- metodi: close, pickSlot, onCalendarSelected

### src/app/features/calendar/dialogs/complete-session-dialog/complete-session-dialog.component.html
- tipo: .html | righe: 15
- template metrics: ngIf=1, ngFor=0, forms=0, material=7, buttons=4, dialogRefs=5

### src/app/features/calendar/dialogs/complete-session-dialog/complete-session-dialog.component.scss
- tipo: .scss | righe: 7
- style metrics: cssVars=0, classBlocks=1, mediaQueries=0, ngDeep=0

### src/app/features/calendar/dialogs/complete-session-dialog/complete-session-dialog.component.ts
- tipo: .ts | righe: 24
- export: CompleteSessionDecision, CompleteSessionDialogData, CompleteSessionDialogComponent
- selector: app-complete-session-dialog
- standalone: true
- interfacce: CompleteSessionDialogData
- type alias: CompleteSessionDecision
- import locali: ../../../../core/modules/material.module
- metodi: choose

### src/app/features/calendar/dialogs/create-project-dialog/create-project-dialog.component.html
- tipo: .html | righe: 14
- template metrics: ngIf=0, ngFor=0, forms=2, material=5, buttons=2, dialogRefs=5

### src/app/features/calendar/dialogs/create-project-dialog/create-project-dialog.component.scss
- tipo: .scss | righe: 4
- style metrics: cssVars=0, classBlocks=1, mediaQueries=0, ngDeep=0

### src/app/features/calendar/dialogs/create-project-dialog/create-project-dialog.component.ts
- tipo: .ts | righe: 54
- export: CreateProjectDialogData, CreateProjectDialogResult, CreateProjectDialogComponent
- selector: app-create-project-dialog
- standalone: true
- interfacce: CreateProjectDialogData, CreateProjectDialogResult
- import locali: ../../../../core/modules/material.module, ../../../../shared/components/form/dynamic-form/dynamic-form.component
- metodi: cancel, save

### src/app/features/calendar/dialogs/new-event-dialog/new-event-dialog/new-event-dialog.component.html
- tipo: .html | righe: 35
- template metrics: ngIf=0, ngFor=1, forms=6, material=19, buttons=2, dialogRefs=3

### src/app/features/calendar/dialogs/new-event-dialog/new-event-dialog/new-event-dialog.component.scss
- tipo: .scss | righe: 14
- style metrics: cssVars=0, classBlocks=3, mediaQueries=0, ngDeep=0

### src/app/features/calendar/dialogs/new-event-dialog/new-event-dialog/new-event-dialog.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./new-event-dialog.component
- metodi: describe, beforeEach, it, expect
- suites: NewEventDialogComponent
- test: should create

### src/app/features/calendar/dialogs/new-event-dialog/new-event-dialog/new-event-dialog.component.ts
- tipo: .ts | righe: 58
- export: NewEventDialogData, NewEventDialogResult, NewEventDialogComponent
- selector: app-new-event-dialog
- standalone: true
- interfacce: NewEventDialogData, NewEventDialogResult
- import locali: ../../../models, ../../../../../core/modules/material.module
- metodi: close, confirm

### src/app/features/calendar/drawer/event-drawer/event-drawer.component.html
- tipo: .html | righe: 236
- template metrics: ngIf=21, ngFor=7, forms=32, material=80, buttons=6, dialogRefs=0

### src/app/features/calendar/drawer/event-drawer/event-drawer.component.scss
- tipo: .scss | righe: 67
- style metrics: cssVars=1, classBlocks=19, mediaQueries=1, ngDeep=14

### src/app/features/calendar/drawer/event-drawer/event-drawer.component.spec.ts
- tipo: .ts | righe: 48
- import locali: ./event-drawer.component
- metodi: describe, beforeEach, it, expect
- suites: EventDrawerComponent
- test: should create | should not show raw client id in booking label when client is missing from cache | should use generic client text instead of id in clientQuery fallback | should submit session without clientId when project is selected

### src/app/features/calendar/drawer/event-drawer/event-drawer.component.ts
- tipo: .ts | righe: 817
- export: UiEventType, ClientLite, ProjectLite, BookingLite, DrawerDraft, EventDrawerResult, CreateProjectTriggerPayload, EventDrawerComponent
- selector: app-event-drawer
- standalone: true
- interfacce: ClientLite, ProjectLite, BookingLite, DrawerDraft, EventDrawerResult, CreateProjectTriggerPayload
- type alias: UiEventType
- import locali: ../../../../core/modules/material.module, ../../models
- metodi: startWith, combineLatest, getClientOptionSubtext, isBooking, isSession, shouldShowSelectedArtistFallback, isSessionEdit, isScheduleLocked, isBookingScheduleLocked, isAssignmentLocked, isBookingAssignmentLocked, recomputeDisabledState, setDisabled, ngOnInit, ngOnChanges, onClientSelected, clearClient, onProjectSelected, onBookingSelected, clearProject, clearBooking, createProjectFromDrawer, onProjectBlur, onBookingBlur, onClientBlur, onSubmit, computeStartEnd, recomputeAvailableTimes, toLocalDateKey, toLocalDateTime, buildTimes, matchClient, matchProject, matchBooking, findClientByAnyId, getClientReadableLabel, extractClientNameFromBookingTitle, matchesAnyId, String, patchFromInitial, hydrateClientQueryFromId, hydrateProjectQueryFromId, hydrateBookingQueryFromId, syncSessionNumberFromProject, formatTime
- ruolo: pannello operazioni evento (creazione/update booking/session/project).

### src/app/features/calendar/models.ts
- tipo: .ts | righe: 79
- export: CalendarViewMode, UiEventType, UiArtist, UiCalendarEvent, CreateDraft, UpdatePatch, AvailabilitySlot, AvailabilityByDateResult, AvailabilityByTimeResult, NewEventSeed
- interfacce: UiArtist, UiCalendarEvent, CreateDraft, UpdatePatch, AvailabilitySlot, AvailabilityByDateResult, AvailabilityByTimeResult, NewEventSeed
- type alias: CalendarViewMode, UiEventType

### src/app/features/calendar/shared/calendar-drawer/calendar-drawer.component.html
- tipo: .html | righe: 1
- template metrics: ngIf=0, ngFor=0, forms=0, material=0, buttons=0, dialogRefs=0

### src/app/features/calendar/shared/calendar-drawer/calendar-drawer.component.scss
- tipo: .scss | righe: 0
- style metrics: cssVars=0, classBlocks=0, mediaQueries=0, ngDeep=0

### src/app/features/calendar/shared/calendar-drawer/calendar-drawer.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./calendar-drawer.component
- metodi: describe, beforeEach, it, expect
- suites: CalendarDrawerComponent
- test: should create

### src/app/features/calendar/shared/calendar-drawer/calendar-drawer.component.ts
- tipo: .ts | righe: 10
- export: CalendarDrawerComponent
- selector: app-calendar-drawer
- standalone: true

### src/app/features/calendar/shared/calendar-grid/calendar-grid.component.html
- tipo: .html | righe: 1
- template metrics: ngIf=0, ngFor=0, forms=0, material=0, buttons=0, dialogRefs=0

### src/app/features/calendar/shared/calendar-grid/calendar-grid.component.scss
- tipo: .scss | righe: 0
- style metrics: cssVars=0, classBlocks=0, mediaQueries=0, ngDeep=0

### src/app/features/calendar/shared/calendar-grid/calendar-grid.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./calendar-grid.component
- metodi: describe, beforeEach, it, expect
- suites: CalendarGridComponent
- test: should create

### src/app/features/calendar/shared/calendar-grid/calendar-grid.component.ts
- tipo: .ts | righe: 10
- export: CalendarGridComponent
- selector: app-calendar-grid
- standalone: true

### src/app/features/calendar/shared/calendar-slot/calendar-slot.component.html
- tipo: .html | righe: 1
- template metrics: ngIf=0, ngFor=0, forms=0, material=0, buttons=0, dialogRefs=0

### src/app/features/calendar/shared/calendar-slot/calendar-slot.component.scss
- tipo: .scss | righe: 0
- style metrics: cssVars=0, classBlocks=0, mediaQueries=0, ngDeep=0

### src/app/features/calendar/shared/calendar-slot/calendar-slot.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./calendar-slot.component
- metodi: describe, beforeEach, it, expect
- suites: CalendarSlotComponent
- test: should create

### src/app/features/calendar/shared/calendar-slot/calendar-slot.component.ts
- tipo: .ts | righe: 10
- export: CalendarSlotComponent
- selector: app-calendar-slot
- standalone: true

### src/app/features/calendar/shared/calendar-toolbar/calendar-toolbar.component.html
- tipo: .html | righe: 30
- template metrics: ngIf=0, ngFor=0, forms=0, material=12, buttons=2, dialogRefs=0

### src/app/features/calendar/shared/calendar-toolbar/calendar-toolbar.component.scss
- tipo: .scss | righe: 0
- style metrics: cssVars=0, classBlocks=0, mediaQueries=0, ngDeep=0

### src/app/features/calendar/shared/calendar-toolbar/calendar-toolbar.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./calendar-toolbar.component
- metodi: describe, beforeEach, it, expect
- suites: CalendarToolbarComponent
- test: should create

### src/app/features/calendar/shared/calendar-toolbar/calendar-toolbar.component.ts
- tipo: .ts | righe: 73
- export: CalendarView, CalendarToolbarComponent
- selector: app-calendar-toolbar
- standalone: true
- changeDetection: OnPush
- type alias: CalendarView
- import locali: ../../../../core/modules/material.module
- metodi: prev, next

### src/app/features/calendar/utils.ts
- tipo: .ts | righe: 49
- export: toDateKey, parseISO, addDays, startOfDay, endOfDay, clampDate, timeToMinutes, minutesToTime, setTimeOnDate, toISO, overlaps

### src/app/features/calendar/views/day-view/day-view.component.html
- tipo: .html | righe: 431
- template metrics: ngIf=40, ngFor=8, forms=8, material=126, buttons=38, dialogRefs=0
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/features/calendar/views/day-view/day-view.component.scss
- tipo: .scss | righe: 771
- style metrics: cssVars=8, classBlocks=160, mediaQueries=7, ngDeep=21
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/features/calendar/views/day-view/day-view.component.spec.ts
- tipo: .ts | righe: 19
- import locali: ./day-view.component
- metodi: describe, beforeEach, it, expect
- suites: DayViewComponent
- test: should create
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/features/calendar/views/day-view/day-view.component.ts
- tipo: .ts | righe: 397
- export: AdminActionType, AdminActionPayload, AgendaItem, AgendaBlock, DayViewComponent
- selector: app-day-view
- standalone: true
- interfacce: AdminActionPayload, AgendaItem, AgendaBlock
- type alias: AdminActionType
- import locali: ../../../../core/modules/material.module, ../../models, ../../utils
- metodi: ngOnChanges, viewDate, prevDay, nextDay, goToday, setQ, setViewMode, setArtistIds, setStatuses, setTypes, toggleArtist, isArtistOpen, createNew, String, kpiToday, resetFilters, toggleFolder, onPage, resetPagination, onClickSlot, openDetails, edit, createSession, setStatus, cancel, noShow, reschedule, assignProject, canConfirm, canPay, canStart, canComplete, formatTime, toAgendaItem, toDayKeyLocal, isSlotAvailable, toLocalDateTime
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/features/calendar/views/month-view/month-view.component.html
- tipo: .html | righe: 20
- template metrics: ngIf=3, ngFor=1, forms=0, material=0, buttons=1, dialogRefs=0
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/features/calendar/views/month-view/month-view.component.scss
- tipo: .scss | righe: 42
- style metrics: cssVars=0, classBlocks=9, mediaQueries=0, ngDeep=0
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/features/calendar/views/month-view/month-view.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./month-view.component
- metodi: describe, beforeEach, it, expect
- suites: MonthViewComponent
- test: should create
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/features/calendar/views/month-view/month-view.component.ts
- tipo: .ts | righe: 49
- export: MonthViewComponent
- selector: app-month-view
- standalone: true
- import locali: ../../models, ../../utils, ../../../../core/modules/material.module
- metodi: ngOnChanges, countForDay
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/features/calendar/views/week-resource/week-resource/week-resource.component.html
- tipo: .html | righe: 41
- template metrics: ngIf=4, ngFor=3, forms=0, material=0, buttons=1, dialogRefs=0
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/features/calendar/views/week-resource/week-resource/week-resource.component.scss
- tipo: .scss | righe: 178
- style metrics: cssVars=0, classBlocks=27, mediaQueries=3, ngDeep=0
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/features/calendar/views/week-resource/week-resource/week-resource.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./week-resource.component
- metodi: describe, beforeEach, it, expect
- suites: WeekResourceComponent
- test: should create
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/features/calendar/views/week-resource/week-resource/week-resource.component.ts
- tipo: .ts | righe: 136
- export: WeekResourceComponent
- selector: app-week-resource
- standalone: true
- import locali: ../../../models, ../../../utils
- metodi: ngOnChanges, intensityClass, artistColor
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/features/calendar/views/week-view/week-view.component.html
- tipo: .html | righe: 54
- template metrics: ngIf=3, ngFor=4, forms=0, material=4, buttons=1, dialogRefs=0
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/features/calendar/views/week-view/week-view.component.scss
- tipo: .scss | righe: 164
- style metrics: cssVars=0, classBlocks=20, mediaQueries=0, ngDeep=0
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/features/calendar/views/week-view/week-view.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./week-view.component
- metodi: describe, beforeEach, it, expect
- suites: WeekViewComponent
- test: should create
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/features/calendar/views/week-view/week-view.component.ts
- tipo: .ts | righe: 181
- export: WeekViewComponent
- selector: week-view
- standalone: true
- import locali: ../../../../core/modules/material.module, ../../calendar.service
- metodi: ngOnChanges, generateHours, getWeekDays, eventsFor, onDrop, alert, openResizeDialog, getDropListId, slotClass, avatarFor, onSlotClick, generateWeekDays, toLocalDateKey, toLocalDateTime
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/shared/components/calendar-v2/calendar/calendar.component.html
- tipo: .html | righe: 118
- template metrics: ngIf=6, ngFor=1, forms=1, material=19, buttons=7, dialogRefs=0

### src/app/shared/components/calendar-v2/calendar/calendar.component.scss
- tipo: .scss | righe: 154
- style metrics: cssVars=31, classBlocks=21, mediaQueries=1, ngDeep=0

### src/app/shared/components/calendar-v2/calendar/calendar.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./calendar.component
- metodi: describe, beforeEach, it, expect
- suites: CalendarComponentV2
- test: should create

### src/app/shared/components/calendar-v2/calendar/calendar.component.ts
- tipo: .ts | righe: 182
- export: CalendarComponentV2
- selector: app-calendar-v2
- standalone: true
- import locali: ../../../../core/modules/material.module, ./views/day-view/day-view.component, ./views/week-view/week-view.component, ./views/month-view/month-view.component, ../models/calendar, ../state/calendar-state/calendar-state.service, ../../form/dynamic-form/dynamic-form.component
- metodi: ngOnInit, ngOnChanges, setView, prev, next, today, openCreate, closeDrawer, onSubmitDrawer, onTypeChanged, setTheme, handleEventDropped

### src/app/shared/components/calendar-v2/calendar/shared/calendar-drawer/calendar-drawer.component.html
- tipo: .html | righe: 1
- template metrics: ngIf=0, ngFor=0, forms=0, material=0, buttons=0, dialogRefs=0

### src/app/shared/components/calendar-v2/calendar/shared/calendar-drawer/calendar-drawer.component.scss
- tipo: .scss | righe: 0
- style metrics: cssVars=0, classBlocks=0, mediaQueries=0, ngDeep=0

### src/app/shared/components/calendar-v2/calendar/shared/calendar-drawer/calendar-drawer.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./calendar-drawer.component
- metodi: describe, beforeEach, it, expect
- suites: CalendarDrawerComponent
- test: should create

### src/app/shared/components/calendar-v2/calendar/shared/calendar-drawer/calendar-drawer.component.ts
- tipo: .ts | righe: 10
- export: CalendarDrawerComponent
- selector: app-calendar-drawer
- standalone: true

### src/app/shared/components/calendar-v2/calendar/shared/calendar-grid/calendar-grid.component.html
- tipo: .html | righe: 1
- template metrics: ngIf=0, ngFor=0, forms=0, material=0, buttons=0, dialogRefs=0

### src/app/shared/components/calendar-v2/calendar/shared/calendar-grid/calendar-grid.component.scss
- tipo: .scss | righe: 0
- style metrics: cssVars=0, classBlocks=0, mediaQueries=0, ngDeep=0

### src/app/shared/components/calendar-v2/calendar/shared/calendar-grid/calendar-grid.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./calendar-grid.component
- metodi: describe, beforeEach, it, expect
- suites: CalendarGridComponent
- test: should create

### src/app/shared/components/calendar-v2/calendar/shared/calendar-grid/calendar-grid.component.ts
- tipo: .ts | righe: 10
- export: CalendarGridComponent
- selector: app-calendar-grid
- standalone: true

### src/app/shared/components/calendar-v2/calendar/shared/calendar-slot/calendar-slot.component.html
- tipo: .html | righe: 1
- template metrics: ngIf=0, ngFor=0, forms=0, material=0, buttons=0, dialogRefs=0

### src/app/shared/components/calendar-v2/calendar/shared/calendar-slot/calendar-slot.component.scss
- tipo: .scss | righe: 0
- style metrics: cssVars=0, classBlocks=0, mediaQueries=0, ngDeep=0

### src/app/shared/components/calendar-v2/calendar/shared/calendar-slot/calendar-slot.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./calendar-slot.component
- metodi: describe, beforeEach, it, expect
- suites: CalendarSlotComponent
- test: should create

### src/app/shared/components/calendar-v2/calendar/shared/calendar-slot/calendar-slot.component.ts
- tipo: .ts | righe: 10
- export: CalendarSlotComponent
- selector: app-calendar-slot
- standalone: true

### src/app/shared/components/calendar-v2/calendar/shared/calendar-toolbar/calendar-toolbar.component.html
- tipo: .html | righe: 30
- template metrics: ngIf=0, ngFor=0, forms=0, material=12, buttons=2, dialogRefs=0

### src/app/shared/components/calendar-v2/calendar/shared/calendar-toolbar/calendar-toolbar.component.scss
- tipo: .scss | righe: 0
- style metrics: cssVars=0, classBlocks=0, mediaQueries=0, ngDeep=0

### src/app/shared/components/calendar-v2/calendar/shared/calendar-toolbar/calendar-toolbar.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./calendar-toolbar.component
- metodi: describe, beforeEach, it, expect
- suites: CalendarToolbarComponent
- test: should create

### src/app/shared/components/calendar-v2/calendar/shared/calendar-toolbar/calendar-toolbar.component.ts
- tipo: .ts | righe: 68
- export: CalendarView, CalendarToolbarComponent
- selector: app-calendar-toolbar
- standalone: true
- changeDetection: OnPush
- type alias: CalendarView
- import locali: ../../../../../../core/modules/material.module
- metodi: prev, next

### src/app/shared/components/calendar-v2/calendar/views/day-view/day-view.component.html
- tipo: .html | righe: 50
- template metrics: ngIf=2, ngFor=3, forms=0, material=3, buttons=2, dialogRefs=0
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/shared/components/calendar-v2/calendar/views/day-view/day-view.component.scss
- tipo: .scss | righe: 118
- style metrics: cssVars=0, classBlocks=14, mediaQueries=1, ngDeep=0
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/shared/components/calendar-v2/calendar/views/day-view/day-view.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./day-view.component
- metodi: describe, beforeEach, it, expect
- suites: DayViewComponent
- test: should create
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/shared/components/calendar-v2/calendar/views/day-view/day-view.component.ts
- tipo: .ts | righe: 75
- export: DayViewComponent
- selector: app-day-view
- standalone: true
- import locali: ../../../../../../core/modules/material.module, ../../../models/calendar
- metodi: ngOnChanges, toISODate, getEventForSlot, handleEmptySlotClick, handleEventClick
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/shared/components/calendar-v2/calendar/views/month-view/month-view.component.html
- tipo: .html | righe: 18
- template metrics: ngIf=2, ngFor=2, forms=0, material=0, buttons=0, dialogRefs=0
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/shared/components/calendar-v2/calendar/views/month-view/month-view.component.scss
- tipo: .scss | righe: 71
- style metrics: cssVars=0, classBlocks=11, mediaQueries=1, ngDeep=0
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/shared/components/calendar-v2/calendar/views/month-view/month-view.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./month-view.component
- metodi: describe, beforeEach, it, expect
- suites: MonthViewComponent
- test: should create
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/shared/components/calendar-v2/calendar/views/month-view/month-view.component.ts
- tipo: .ts | righe: 62
- export: MonthViewComponent
- selector: app-month-view
- standalone: true
- import locali: ../../../../../../core/modules/material.module, ../../../models/calendar
- metodi: ngOnChanges, buildMonth, toISODate, handleDayClick
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/shared/components/calendar-v2/calendar/views/week-view/week-view.component.html
- tipo: .html | righe: 51
- template metrics: ngIf=0, ngFor=4, forms=0, material=0, buttons=0, dialogRefs=0
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/shared/components/calendar-v2/calendar/views/week-view/week-view.component.scss
- tipo: .scss | righe: 109
- style metrics: cssVars=0, classBlocks=15, mediaQueries=1, ngDeep=0
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/shared/components/calendar-v2/calendar/views/week-view/week-view.component.spec.ts
- tipo: .ts | righe: 18
- import locali: ./week-view.component
- metodi: describe, beforeEach, it, expect
- suites: WeekViewComponent
- test: should create
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/shared/components/calendar-v2/calendar/views/week-view/week-view.component.ts
- tipo: .ts | righe: 105
- export: WeekViewComponent
- selector: app-week-view
- standalone: true
- metodi: ngOnChanges, buildWeekDays, onSlotClick, getEventsForSlot, isMine
- ruolo: rendering per vista temporale (day/week/month/resource).

### src/app/shared/components/calendar-v2/models/calendar.ts
- tipo: .ts | righe: 67
- export: CalendarView, CalendarEventType, CalendarEventStatus, CalendarEvent, BookingDraftPayload, CalendarDragUpdate
- interfacce: CalendarEvent, BookingDraftPayload, CalendarDragUpdate
- type alias: CalendarView, CalendarEventType, CalendarEventStatus

### src/app/shared/components/calendar-v2/state/calendar-state/calendar-state.service.spec.ts
- tipo: .ts | righe: 12
- import locali: ./calendar-state.service
- metodi: describe, beforeEach, it, expect
- suites: CalendarStateService
- test: should be created

### src/app/shared/components/calendar-v2/state/calendar-state/calendar-state.service.ts
- tipo: .ts | righe: 110
- export: CalendarStateService
- import locali: ../../models/calendar
- metodi: setView, setDate, setToday, setEvents, next, prev, shiftDate, buildTitle

