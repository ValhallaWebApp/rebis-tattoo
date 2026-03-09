import { Injectable, computed, signal } from '@angular/core';
import { Database, onValue, ref, update } from '@angular/fire/database';

export interface AdminSectionDefinition {
  key: string;
  label: string;
  route: string;
  description: string;
}

const ADMIN_SECTION_DEFINITIONS: AdminSectionDefinition[] = [
  { key: 'calendar', label: 'Calendario', route: '/admin/calendar', description: 'Agenda e gestione appuntamenti' },
  { key: 'users', label: 'Utenti', route: '/admin/users', description: 'Utenti globali del gestionale' },
  { key: 'clients', label: 'Clienti', route: '/admin/clients', description: 'Anagrafica clienti' },
  { key: 'staff', label: 'Staff', route: '/admin/staff', description: 'Gestione membri staff' },
  { key: 'permissions', label: 'Permessi', route: '/admin/permissions', description: 'Deleghe operative staff' },
  { key: 'portfolio', label: 'Portfolio', route: '/admin/portfolio', description: 'Progetti e lavori' },
  { key: 'servizi', label: 'Servizi', route: '/admin/servizi', description: 'Catalogo servizi studio' },
  { key: 'reviews', label: 'Recensioni', route: '/admin/reviews', description: 'Moderazione recensioni' },
  { key: 'messaging', label: 'Messaggi', route: '/admin/messaging', description: 'Chat e ticket clienti' },
  { key: 'eventi', label: 'Eventi', route: '/admin/eventi', description: 'Open day e guest event' },
  { key: 'billing', label: 'Fatturazione', route: '/admin/billing', description: 'Pagamenti e incassi' },
  { key: 'bonus', label: 'Bonus', route: '/admin/bonus', description: 'Promo, wallet e gift card' },
  { key: 'analytics', label: 'Analytics', route: '/admin/analytics', description: 'KPI e andamento' },
  { key: 'audit-logs', label: 'Audit Logs', route: '/admin/audit-logs', description: 'Storico operazioni' },
  { key: 'documents', label: 'Documenti', route: '/admin/documents', description: 'Archivio documentale' },
  { key: 'waitlist', label: 'Waitlist', route: '/admin/waitlist', description: 'Clienti in attesa' },
  { key: 'settings', label: 'Impostazioni Studio', route: '/admin/settings', description: 'Contenuti e dati studio' },
  { key: 'client-profile', label: 'Client - Profilo', route: '/dashboard', description: 'Scheda profilo cliente' },
  { key: 'client-booking-history', label: 'Client - Storico consulenze', route: '/dashboard/booking-history', description: 'Storico appuntamenti e consulenze' },
  { key: 'client-buoni', label: 'Client - Buoni', route: '/dashboard/buoni', description: 'Sezione buoni e promo cliente' },
  { key: 'client-reviews', label: 'Client - Recensioni', route: '/dashboard/reviews', description: 'Recensioni lato cliente' },
  { key: 'client-chat', label: 'Client - Chat', route: '/dashboard/chat', description: 'Chat assistenza cliente' }
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
    for (const def of this.definitions) {
      if (Object.prototype.hasOwnProperty.call(raw, def.key)) {
        out[def.key] = raw[def.key] === true;
      }
    }
    return out;
  }
}
