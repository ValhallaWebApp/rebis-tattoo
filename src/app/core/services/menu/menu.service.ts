import { Injectable } from '@angular/core';
import { Database, ref, get, set, push, update, remove, child } from '@angular/fire/database';
import { from, map, Observable } from 'rxjs';

export interface MenuItem {
  label: string;
  route: string;
  roles?: string[];
  children?: MenuItem[];
}

@Injectable({ providedIn: 'root' })
export class MenuService {
  menu = {
  "public": [
    { "label": "Home", "route": "/home" },
    { "label": "Servizi", "route": "/servizi" },
    { "label": "Progetti", "route": "/progetti" },
    { "label": "Bookings", "route": "/bookings" },
    { "label": "Chi Siamo", "route": "/chi-siamo" },
    { "label": "Contatti", "route": "/contatti" }
  ],
  "client": [
    {
      "label": "Dashboard",
      "route": "/dashboard",
      "roles": ["client", "admin"],
      "children": [
        { "label": "dashboard", "route": "/dashboard/" },
        { "label": "Booking History", "route": "/dashboard/booking-history" },
        { "label": "Messaging", "route": "/dashboard/messaging" },
        { "label": "Reviews", "route": "/dashboard/reviews" },
        { "label": "Invoices", "route": "/dashboard/invoices" },
        { "label": "Settings", "route": "/dashboard/settings" }
      ]
    }
  ],
  "admin": [
    {
      "label": "Admin",
      "route": "/admin",
      "roles": ["admin"],
      "children": [
        { "label": "Dashboard", "route": "/admin" },
        { "label": "Calendar", "route": "/admin/calendar" },
        { "label": "Clients", "route": "/admin/clients" },
        { "label": "Billing", "route": "/admin/billing" },
        { "label": "Documents", "route": "/admin/documents" },
        { "label": "Waitlist", "route": "/admin/waitlist" },
        { "label": "Messaging", "route": "/admin/messaging" },
        { "label": "Portfolio", "route": "/admin/portfolio" },
        { "label": "Servizi", "route": "/admin/servizi" },
        { "label": "Staff", "route": "/admin/staff" },
        { "label": "Analytics", "route": "/admin/analytics" },
        { "label": "Settings", "route": "/admin/settings" },
        { "label": "Review List", "route": "/admin/review-list" }
      ]
    }
  ]
}

  constructor(private db: Database) {}


  /** 🔹 Recupera tutte le sezioni di menu (public, client, admin) */
getMenuByRole(role: 'public' | 'client' | 'admin'): Observable<MenuItem[]> {
  const sectionsToLoad: string[] =
    role === 'admin' ? ['public', 'client', 'admin'] :
    role === 'client' ? ['public', 'client'] :
    ['public'];

  const observables = sectionsToLoad.map(section => {
    const refPath = ref(this.db, `menuItems/${section}`);
    return from(get(refPath)).pipe(
      map(snapshot => {
        const val = snapshot.val();
        if (!val) return [];
        return Array.isArray(val) ? val : Object.values(val);
      })
    );
  });

  return new Observable<MenuItem[]>(subscriber => {
    Promise.all(observables.map(o => o.toPromise()))
      .then(results => {
        const merged = results.flat();
        subscriber.next(merged);
        subscriber.complete();
      })
      .catch(err => subscriber.error(err));
  });
}


  getAllMenus(): Observable<{ public: MenuItem[]; client: MenuItem[]; admin: MenuItem[] }> {
    const rootRef = ref(this.db, `menuItems`);
    return from(get(rootRef)).pipe(
      map(snapshot => snapshot.exists() ? snapshot.val() : { public: [], client: [], admin: [] })
    );
  }

  /** 🟢 Aggiunge una nuova voce a una sezione */
  addMenuItem(section: 'public' | 'client' | 'admin', item: MenuItem): Observable<void> {
    const sectionRef = ref(this.db, `menuItems/${section}`);
    const newRef = push(sectionRef);
    return from(set(newRef, item));
  }

  /** 🟡 Aggiorna una voce del menu */
  updateMenuItem(section: 'public' | 'client' | 'admin', key: string, updatedItem: Partial<MenuItem>): Observable<void> {
    const itemRef = ref(this.db, `menuItems/${section}/${key}`);
    return from(update(itemRef, updatedItem));
  }
/** 🚀 Carica l'intero menu predefinito su Firebase */
uploadDefaultMenu(): Observable<void> {
  const rootRef = ref(this.db, 'menuItems');
  return from(set(rootRef, this.menu));
}

  /** 🔴 Elimina una voce del menu */
  deleteMenuItem(section: 'public' | 'client' | 'admin', key: string): Observable<void> {
    const itemRef = ref(this.db, `menuItems/${section}/${key}`);
    return from(remove(itemRef));
  }
}
