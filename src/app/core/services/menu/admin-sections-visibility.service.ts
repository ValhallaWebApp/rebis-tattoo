import { Injectable, computed, signal } from '@angular/core';
import { Database, onValue, ref, update } from '@angular/fire/database';

export interface AdminSectionDefinition {
  key: string;
  labelKey: string;
  route: string;
  descriptionKey: string;
}

const ADMIN_SECTION_DEFINITIONS: AdminSectionDefinition[] = [
  { key: 'calendar', labelKey: 'adminSectionsVisibility.definitions.calendar.label', route: '/admin/calendar', descriptionKey: 'adminSectionsVisibility.definitions.calendar.description' },
  { key: 'users', labelKey: 'adminSectionsVisibility.definitions.users.label', route: '/admin/users', descriptionKey: 'adminSectionsVisibility.definitions.users.description' },
  { key: 'clients', labelKey: 'adminSectionsVisibility.definitions.clients.label', route: '/admin/clients', descriptionKey: 'adminSectionsVisibility.definitions.clients.description' },
  { key: 'staff', labelKey: 'adminSectionsVisibility.definitions.staff.label', route: '/admin/staff', descriptionKey: 'adminSectionsVisibility.definitions.staff.description' },
  { key: 'permissions', labelKey: 'adminSectionsVisibility.definitions.permissions.label', route: '/admin/permissions', descriptionKey: 'adminSectionsVisibility.definitions.permissions.description' },
  { key: 'portfolio', labelKey: 'adminSectionsVisibility.definitions.portfolio.label', route: '/admin/portfolio', descriptionKey: 'adminSectionsVisibility.definitions.portfolio.description' },
  { key: 'servizi', labelKey: 'adminSectionsVisibility.definitions.servizi.label', route: '/admin/servizi', descriptionKey: 'adminSectionsVisibility.definitions.servizi.description' },
  { key: 'reviews', labelKey: 'adminSectionsVisibility.definitions.reviews.label', route: '/admin/reviews', descriptionKey: 'adminSectionsVisibility.definitions.reviews.description' },
  { key: 'messaging', labelKey: 'adminSectionsVisibility.definitions.messaging.label', route: '/admin/messaging', descriptionKey: 'adminSectionsVisibility.definitions.messaging.description' },
  { key: 'eventi', labelKey: 'adminSectionsVisibility.definitions.eventi.label', route: '/admin/eventi', descriptionKey: 'adminSectionsVisibility.definitions.eventi.description' },
  { key: 'billing', labelKey: 'adminSectionsVisibility.definitions.billing.label', route: '/admin/billing', descriptionKey: 'adminSectionsVisibility.definitions.billing.description' },
  { key: 'bonus', labelKey: 'adminSectionsVisibility.definitions.bonus.label', route: '/admin/bonus', descriptionKey: 'adminSectionsVisibility.definitions.bonus.description' },
  { key: 'analytics', labelKey: 'adminSectionsVisibility.definitions.analytics.label', route: '/admin/analytics', descriptionKey: 'adminSectionsVisibility.definitions.analytics.description' },
  { key: 'audit-logs', labelKey: 'adminSectionsVisibility.definitions.auditLogs.label', route: '/admin/audit-logs', descriptionKey: 'adminSectionsVisibility.definitions.auditLogs.description' },
  { key: 'documents', labelKey: 'adminSectionsVisibility.definitions.documents.label', route: '/admin/documents', descriptionKey: 'adminSectionsVisibility.definitions.documents.description' },
  { key: 'waitlist', labelKey: 'adminSectionsVisibility.definitions.waitlist.label', route: '/admin/waitlist', descriptionKey: 'adminSectionsVisibility.definitions.waitlist.description' },
  { key: 'settings', labelKey: 'adminSectionsVisibility.definitions.settings.label', route: '/admin/settings', descriptionKey: 'adminSectionsVisibility.definitions.settings.description' },
  { key: 'client-profile', labelKey: 'adminSectionsVisibility.definitions.clientProfile.label', route: '/dashboard', descriptionKey: 'adminSectionsVisibility.definitions.clientProfile.description' },
  { key: 'client-tattoos', labelKey: 'adminSectionsVisibility.definitions.clientTattoos.label', route: '/dashboard/tatuaggi', descriptionKey: 'adminSectionsVisibility.definitions.clientTattoos.description' },
  { key: 'client-booking-history', labelKey: 'adminSectionsVisibility.definitions.clientBookingHistory.label', route: '/dashboard/booking-history', descriptionKey: 'adminSectionsVisibility.definitions.clientBookingHistory.description' },
  { key: 'client-buoni', labelKey: 'adminSectionsVisibility.definitions.clientBuoni.label', route: '/dashboard/buoni', descriptionKey: 'adminSectionsVisibility.definitions.clientBuoni.description' },
  { key: 'client-reviews', labelKey: 'adminSectionsVisibility.definitions.clientReviews.label', route: '/dashboard/reviews', descriptionKey: 'adminSectionsVisibility.definitions.clientReviews.description' },
  { key: 'client-chat', labelKey: 'adminSectionsVisibility.definitions.clientChat.label', route: '/dashboard/chat', descriptionKey: 'adminSectionsVisibility.definitions.clientChat.description' }
];

type VisibilityMap = Record<string, boolean>;

@Injectable({ providedIn: 'root' })
export class AdminSectionsVisibilityService {
  private readonly path = 'studioProfile/admin/menuVisibility';
  readonly definitions = ADMIN_SECTION_DEFINITIONS;
  private readonly _visibility = signal<VisibilityMap>(this.defaultVisibility());
  private readonly _ready = signal(false);

  readonly ready = this._ready.asReadonly();
  readonly visibility = this._visibility.asReadonly();
  readonly sections = computed(() =>
    this.definitions.map((item) => ({
      ...item,
      visible: this._visibility()[item.key] !== false
    }))
  );

  constructor(private readonly db: Database) {
    const node = ref(this.db, this.path);
    onValue(
      node,
      (snap) => {
        const raw = (snap.exists() ? snap.val() : {}) as Record<string, unknown>;
        this._visibility.set(this.normalize(raw));
        this._ready.set(true);
      },
      () => {
        this._visibility.set(this.defaultVisibility());
        this._ready.set(true);
      }
    );
  }

  isVisible(route: string): boolean {
    const key = this.routeToKey(route);
    if (!key) return true;
    return this._visibility()[key] !== false;
  }

  async setVisible(sectionKey: string, visible: boolean): Promise<void> {
    if (!this.isKnownKey(sectionKey)) return;
    this._visibility.update((curr) => ({ ...curr, [sectionKey]: visible }));
    await update(ref(this.db, this.path), { [sectionKey]: visible });
  }

  private isKnownKey(sectionKey: string): boolean {
    return this.definitions.some((d) => d.key === sectionKey);
  }

  private routeToKey(route: string): string | null {
    const normalized = String(route ?? '').trim().toLowerCase();
    if (!normalized) return null;
    const noQuery = normalized.split('?')[0].split('#')[0];

    if (noQuery.startsWith('/admin/')) {
      return noQuery.slice('/admin/'.length).split('/')[0] || null;
    }
    if (noQuery.startsWith('/staff/')) {
      return noQuery.slice('/staff/'.length).split('/')[0] || null;
    }
    if (noQuery === '/dashboard' || noQuery === '/dashboard/') {
      return 'client-profile';
    }
    if (noQuery.startsWith('/dashboard/')) {
      const child = noQuery.slice('/dashboard/'.length).split('/')[0] || '';
      switch (child) {
        case 'booking-history':
          return 'client-booking-history';
        case 'projects':
        case 'tatuaggi':
          return 'client-tattoos';
        case 'buoni':
          return 'client-buoni';
        case 'reviews':
          return 'client-reviews';
        case 'chat':
          return 'client-chat';
        default:
          return null;
      }
    }
    return null;
  }

  private defaultVisibility(): VisibilityMap {
    return ADMIN_SECTION_DEFINITIONS.reduce<VisibilityMap>((acc, def) => {
      acc[def.key] = true;
      return acc;
    }, {});
  }

  private normalize(raw: Record<string, unknown>): VisibilityMap {
    const out = this.defaultVisibility();
    if (Object.prototype.hasOwnProperty.call(raw, 'client-projects') && !Object.prototype.hasOwnProperty.call(raw, 'client-tattoos')) {
      out['client-tattoos'] = raw['client-projects'] === true;
    }
    for (const def of this.definitions) {
      if (Object.prototype.hasOwnProperty.call(raw, def.key)) {
        out[def.key] = raw[def.key] === true;
      }
    }
    return out;
  }
}
