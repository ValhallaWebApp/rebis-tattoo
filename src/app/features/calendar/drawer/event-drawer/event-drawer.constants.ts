export const EVENT_DRAWER_DURATION_OPTIONS = [30, 45, 60, 90, 120, 150, 180] as const;

export const EVENT_DRAWER_BOOKING_STATUS_OPTIONS = [
  { value: 'draft', label: 'Bozza' },
  { value: 'pending', label: 'In attesa' },
  { value: 'confirmed', label: 'Confermata' },
  { value: 'paid', label: 'Pagata' },
  { value: 'in_progress', label: 'In corso' },
  { value: 'completed', label: 'Completata' },
  { value: 'cancelled', label: 'Annullata' },
  { value: 'no_show', label: 'No-show' }
] as const;

export const EVENT_DRAWER_SESSION_STATUS_OPTIONS = [
  { value: 'planned', label: 'Pianificata' },
  { value: 'completed', label: 'Completata' },
  { value: 'cancelled', label: 'Annullata' }
] as const;
