import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface MenuItem {
  label: string;
  route: string;
  roles?: string[];
  children?: MenuItem[];
}

type MenuSection = 'public' | 'client' | 'staff' | 'admin';

export interface MenuUserContext {
  uid?: string;
  role?: string;
  permissions?: {
    canManageRoles?: boolean;
    canManageBookings?: boolean;
    canManageProjects?: boolean;
    canManageSessions?: boolean;
    canReassignProjectArtist?: boolean;
    canReassignProjectClient?: boolean;
    [key: string]: boolean | undefined;
  };
}

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

  private readonly staffClientZoneMenu: MenuItem = {
    label: 'Client Zone',
    route: '/dashboard',
    roles: ['staff'],
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
    roles: ['admin'],
    children: [
      { label: 'Dashboard', route: '/admin' },
      { label: 'Calendario', route: '/admin/calendar' },
      { label: 'Clienti', route: '/admin/clients' },
      { label: 'Permessi', route: '/admin/permissions' },
      { label: 'Servizi', route: '/admin/servizi' },
      { label: 'Portfolio', route: '/admin/portfolio' },
      { label: 'Staff', route: '/admin/staff' }
    ]
  };

  getMenuByRole(role: MenuSection): Observable<MenuItem[]> {
    switch (role) {
      case 'client':
        return of(this.cloneMenu(this.buildClientMenu()));
      case 'staff':
        return of(this.cloneMenu(this.buildStaffMenu({
          canManageRoles: false,
          canManageBookings: false,
          canManageProjects: false
        })));
      case 'admin':
        return of(this.cloneMenu(this.buildAdminMenu()));
      case 'public':
      default:
        return of(this.cloneMenu(this.buildPublicMenu()));
    }
  }

  getMenuByUser(user: MenuUserContext | null | undefined): Observable<MenuItem[]> {
    if (!user) return this.getMenuByRole('public');

    const role = this.normalizeRole(user.role);
    if (role === 'public') return this.getMenuByRole('public');
    if (role === 'client') return this.getMenuByRole('client');

    if (role === 'admin') {
      return of(this.cloneMenu(this.buildAdminMenu()));
    }

    const canManageRoles = user.permissions?.canManageRoles === true;
    const canManageBookings = user.permissions?.canManageBookings === true;
    const canManageProjects = user.permissions?.canManageProjects === true;
    return of(this.cloneMenu(this.buildStaffMenu({ canManageRoles, canManageBookings, canManageProjects })));
  }

  private buildPublicMenu(): MenuItem[] {
    return [...this.publicMenu];
  }

  private buildClientMenu(): MenuItem[] {
    return [...this.publicMenu, this.dashboardMenu];
  }

  private buildAdminMenu(): MenuItem[] {
    return [...this.publicMenu, this.dashboardMenu, this.adminMenu];
  }

  private buildStaffMenu(flags: { canManageRoles: boolean; canManageBookings: boolean; canManageProjects: boolean }): MenuItem[] {
    const staffAdminMenu = this.buildStaffAdminMenu(flags);
    return staffAdminMenu
      ? [...this.publicMenu, this.staffClientZoneMenu, staffAdminMenu]
      : [...this.publicMenu, this.staffClientZoneMenu];
  }

  private buildStaffAdminMenu(flags: { canManageRoles: boolean; canManageBookings: boolean; canManageProjects: boolean }): MenuItem | null {
    const children: MenuItem[] = [];

    if (flags.canManageBookings) {
      children.push({ label: 'Calendario', route: '/staff/calendar' });
    }

    if (flags.canManageProjects) {
      children.push({ label: 'Progetti', route: '/staff/portfolio' });
    }

    if (flags.canManageRoles) {
      children.push({ label: 'Clienti', route: '/staff/clients' });
    }

    if (children.length === 0) return null;

    return {
      label: 'Staff',
      route: '/staff',
      roles: ['staff'],
      children
    };
  }

  private normalizeRole(role: string | undefined): MenuSection {
    const normalized = String(role ?? 'public').trim().toLowerCase();
    if (normalized === 'user') return 'client';
    if (normalized === 'admin' || normalized === 'client' || normalized === 'staff' || normalized === 'public') {
      return normalized;
    }
    return 'public';
  }

  private cloneMenu(items: MenuItem[]): MenuItem[] {
    return items.map(item => ({
      ...item,
      roles: item.roles ? [...item.roles] : undefined,
      children: item.children ? this.cloneMenu(item.children) : undefined
    }));
  }
}
