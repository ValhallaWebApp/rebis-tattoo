# Admin/Client Angular Enterprise Checklist

## Scope
- Included: `src/app/features/admin`, `src/app/features/clients`
- Excluded for now: `src/app/features/public`

## Current architecture snapshot
- Components in scope: `31`
- Components using constructor DI: `16`
- Components using `inject()`: `13`
- Components using `OnPush`: `0`
- Largest components:
  - `project-manager.component.ts` (~625 lines)
  - `calendar-admin.component.ts` (~520 lines)
  - `project-tracker.component.ts` (~465 lines)
  - `booking-history.component.ts` (~444 lines)

## Main findings (from code)
- Duplicate domain/UI logic between:
  - `admin/components/project-manager/*`
  - `admin/components/project-tracker/*`
- Repeated helpers across components/services:
  - date normalization/format
  - money formatting
  - permission checks / route base checks
- Route components include too much orchestration + business logic instead of facade/view-model split.
- Many manual subscriptions and imperative state flows where signal-based VM would simplify code and testability.
- Client booking-history mixes domain UI with document generation/export logic.
- Messaging has two similar UIs (`admin` vs `client`) with duplicated thread/message orchestration.

## Target architecture (enterprise-friendly)
- Thin route components (container only).
- Feature facades with signals/computed/effect for all UI state.
- Reusable presentational components with typed inputs/outputs.
- Reusable UI primitives for status chips, empty states, KPI cards, action bars, list rows.
- Centralized helper layer for date/time, currency, statuses, permissions, notifications.
- Route-level providers for scoped feature state where needed.

## Implementation checklist

### P0 - High impact, low risk
- [x] Add shared `DateTimeFacade` (normalize/format/toLocalDateTime) and replace duplicated local methods in admin/client.
- [x] Add shared `MoneyFormatterService` + `StatusLabelService` (booking/project/review/session).
- [x] Add `PermissionFacade` (`has`, `isAdmin`, `isStaff`, `backofficeBase`) and remove duplicated checks in components.
- [ ] Add `UiActionService` wrappers for external actions (`openWhatsApp`, `openMailto`, `downloadBlob`) to remove direct browser API usage from route components.
- [ ] Migrate admin/client components to `inject()` consistently (no mixed DI style).
- [ ] Introduce `ChangeDetectionStrategy.OnPush` on all admin/client standalone components and verify templates.

### P1 - Component reuse
- [ ] Extract reusable `project-summary-card` from project manager/tracker shared head section.
- [ ] Extract reusable `project-kpi-strip` (booking/session/payment KPIs).
- [ ] Extract reusable `booking-summary-panel`.
- [ ] Extract reusable `session-list-panel` + `session-row`.
- [ ] Extract reusable `conversation-thread-list` + `conversation-message-list` for messaging admin/client.
- [ ] Add reusable `status-badge` with centralized status->style mapping.
- [ ] Add reusable `empty-state` component for all empty/load/error blocks.

### P2 - State/facade reorganization
- [ ] Create `ProjectManagementFacade` for project manager page state and actions.
- [ ] Create `ProjectTrackerFacade` for single-project page VM.
- [ ] Create `ClientDashboardFacade` for profile + booking + project state.
- [ ] Create `MessagingFacade` shared by admin and client messaging pages.
- [ ] Convert route pages to consume readonly signals (`vm`, `filters`, `loading`, `error`) from facade only.

### P3 - Forms and dialogs
- [ ] Introduce typed form builders for all forms still using untyped `FormGroup`.
- [ ] Create shared form schema/helpers for repeated fields (code, amount, date, notes, status).
- [ ] Standardize dialogs/drawers opening logic through a single `OverlayFacade` helper.
- [ ] Remove "simulation" actions and bind to real domain use-cases or feature-flag them.

### P4 - Testing and quality gates
- [ ] Add unit tests for each new facade (signal-derived VM + action methods).
- [ ] Add component tests for reusable primitives (status, panels, empty-state).
- [ ] Add e2e flows for admin project lifecycle + client booking lifecycle.
- [ ] Add lint rules/checks for:
  - max component TS LOC threshold
  - no direct `window/document` in feature components
  - no duplicated status mapping strings across features

## Recommended execution order
1. P0 shared helpers/services + OnPush + inject consistency.
2. P1 extraction for project pages + messaging.
3. P2 facade migration.
4. P3 forms/dialog standardization.
5. P4 test hardening and CI quality gates.

## Progress log
- Step 1 completed:
  - Added helpers:
    - `core/services/helpers/date-time-helper.service.ts`
    - `core/services/helpers/currency-helper.service.ts`
    - `core/services/helpers/backoffice-access.service.ts`
  - Refactored:
    - `features/admin/components/project-manager/project-manager.component.ts`
    - `features/admin/components/project-tracker/project-tracker.component.ts`
  - Removed duplicated local logic for:
    - date/time normalization and formatting
    - EUR formatting
    - backoffice base route and permission checks
- Step 2 completed:
  - Added helper:
    - `core/services/helpers/external-actions-helper.service.ts`
  - Refactored:
    - `features/admin/components/project-manager/project-manager.component.ts`
    - `features/clients/components/booking-history/booking-history.component.ts`
  - Replaced direct browser API usage (`window.open`, blob download boilerplate) with helper calls.
- Step 3 completed:
  - Added helper:
    - `core/services/helpers/status-helper.service.ts`
  - Refactored:
    - `features/admin/admin-dashboard/admin-dashboard.component.ts`
    - `features/admin/components/project-manager/project-manager.component.ts`
    - `features/admin/components/project-tracker/project-tracker.component.ts`
    - `features/admin/components/project-tracker/project-tracker.component.html`
    - `features/clients/components/profile/profile.component.ts`
  - Centralized mapping for:
    - booking/review status labels and tones
    - project status labels (admin/client variants)
    - session status normalization/labeling
  - Additional alignment:
    - `admin-dashboard` migrated from constructor DI to `inject()` style.
- Step 4 completed (responsive hardening):
  - Refactored SCSS breakpoints and overflow behavior in:
    - `features/clients/components/profile/profile.component.scss`
    - `features/admin/components/permissions-admin/permissions-admin.component.scss`
    - `features/admin/components/bonus-admin/bonus-admin.component.scss`
    - `features/admin/components/services-admin/services-admin.component.scss`
    - `features/admin/admin-dashboard/admin-dashboard.component.scss`
    - `features/admin/components/users-management/users-management.component.scss`
    - `features/admin/components/calendar-admin/calendar-admin.component.scss`
    - `features/admin/components/analytics/analytics.component.scss`

## Product decisions (dashboard IA)
- Admin dashboard should prioritize:
  - operational exceptions, pending approvals, SLA risks, today actions.
- Client dashboard should prioritize:
  - next booking actions, booking change/cancel/help, payment/documents, project progress with next step.
- Client should see project status, but with simplified domain:
  - `Pianificato` -> `In corso` -> `Guarigione` -> `Completato`
  - each state must expose one clear "next action".
