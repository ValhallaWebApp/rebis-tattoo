import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface MenuItem {
  label: string;
  route: string;
  roles?: string[];
  children?: MenuItem[];
}

type MenuSection = 'public' | 'client' | 'staff' | 'admin';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly publicMenu: MenuItem[] = [
    { label: 'Home', route: '/home' },
    { label: 'Servizi', route: '/servizi' },
    { label: 'Progetti', route: '/progetti' },
    { label: 'Fast Booking', route: '/fast-booking' },
    { label: 'Chi Siamo', route: '/chi-siamo' },
    { label: 'Contatti', route: '/contatti' }
  ];

  private readonly dashboardMenu: MenuItem = {
    label: 'Dashboard',
    route: '/dashboard',
    roles: ['client', 'staff', 'admin'],
    children: [
      { label: 'Profilo', route: '/dashboard' },
      { label: 'Storico Booking', route: '/dashboard/booking-history' },
      { label: 'Buoni', route: '/dashboard/buoni' },
      { label: 'Recensioni', route: '/dashboard/reviews' },
      { label: 'Chat', route: '/dashboard/chat' }
    ]
  };

  private readonly adminMenu: MenuItem = {
    label: 'Admin',
    route: '/admin',
    roles: ['staff', 'admin'],
    children: [
      { label: 'Dashboard', route: '/admin' },
      { label: 'Calendario', route: '/admin/calendar' },
      { label: 'Clienti', route: '/admin/clients' },
      { label: 'Billing', route: '/admin/billing' },
      { label: 'Documenti', route: '/admin/documents' },
      { label: 'Waitlist', route: '/admin/waitlist' },
      { label: 'Messaggi', route: '/admin/messaging' },
      { label: 'Portfolio', route: '/admin/portfolio' },
      { label: 'Servizi', route: '/admin/servizi' },
      { label: 'Staff', route: '/admin/staff' },
      { label: 'Bonus', route: '/admin/bonus' },
      { label: 'Analytics', route: '/admin/analytics' },
      { label: 'Audit Logs', route: '/admin/audit-logs' },
      { label: 'Impostazioni', route: '/admin/settings' },
      { label: 'Recensioni', route: '/admin/review-list' }
    ]
  };

  private readonly menuByRole: Record<MenuSection, MenuItem[]> = {
    public: [...this.publicMenu],
    client: [...this.publicMenu, this.dashboardMenu],
    staff: [...this.publicMenu, this.dashboardMenu, this.adminMenu],
    admin: [...this.publicMenu, this.dashboardMenu, this.adminMenu]
  };

  getMenuByRole(role: MenuSection): Observable<MenuItem[]> {
    return of(this.cloneMenu(this.menuByRole[role] ?? this.menuByRole.public));
  }

  private cloneMenu(items: MenuItem[]): MenuItem[] {
    return items.map(item => ({
      ...item,
      roles: item.roles ? [...item.roles] : undefined,
      children: item.children ? this.cloneMenu(item.children) : undefined
    }));
  }
}
