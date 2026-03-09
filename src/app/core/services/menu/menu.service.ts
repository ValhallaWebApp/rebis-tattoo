import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AdminSectionsVisibilityService } from './admin-sections-visibility.service';
import { LanguageService } from '../language/language.service';

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
    canManageEvents?: boolean;
    canManageSessions?: boolean;
    canReassignProjectArtist?: boolean;
    canReassignProjectClient?: boolean;
    [key: string]: boolean | undefined;
  };
}

@Injectable({ providedIn: 'root' })
export class MenuService {
  constructor(
    private readonly sectionsVisibility: AdminSectionsVisibilityService,
    private readonly lang: LanguageService
  ) {}

  private buildPublicMenuItems(): MenuItem[] {
    return [
      { label: this.lang.t('menu.public.home'), route: '/home' },
      { label: this.lang.t('menu.public.services'), route: '/servizi' },
      { label: this.lang.t('menu.public.showcase'), route: '/progetti' },
      { label: this.lang.t('menu.public.events'), route: '/eventi' },
      { label: this.lang.t('menu.public.fastConsultation'), route: '/fast-booking' },
      { label: this.lang.t('menu.public.about'), route: '/chi-siamo' },
      { label: this.lang.t('menu.public.contacts'), route: '/contatti' }
    ];
  }

  private buildDashboardMenu(): MenuItem {
    return {
      label: this.lang.t('menu.dashboard.title'),
      route: '/dashboard',
      roles: ['client', 'staff', 'admin'],
      children: [
        { label: this.lang.t('menu.dashboard.profile'), route: '/dashboard' },
        { label: this.lang.t('menu.dashboard.tattoos'), route: '/dashboard/tatuaggi' },
        { label: this.lang.t('menu.dashboard.bookingHistory'), route: '/dashboard/booking-history' },
        { label: this.lang.t('menu.dashboard.bonus'), route: '/dashboard/buoni' },
        { label: this.lang.t('menu.dashboard.reviews'), route: '/dashboard/reviews' },
        { label: this.lang.t('menu.dashboard.chat'), route: '/dashboard/chat' }
      ]
    };
  }

  private buildStaffClientZoneMenu(): MenuItem {
    return {
      label: this.lang.t('menu.staffClientZone.title'),
      route: '/dashboard',
      roles: ['staff'],
      children: [
        { label: this.lang.t('menu.dashboard.profile'), route: '/dashboard' },
        { label: this.lang.t('menu.dashboard.tattoos'), route: '/dashboard/tatuaggi' },
        { label: this.lang.t('menu.dashboard.bookingHistory'), route: '/dashboard/booking-history' },
        { label: this.lang.t('menu.dashboard.bonus'), route: '/dashboard/buoni' },
        { label: this.lang.t('menu.dashboard.reviews'), route: '/dashboard/reviews' },
        { label: this.lang.t('menu.dashboard.chat'), route: '/dashboard/chat' }
      ]
    };
  }

  private buildAdminMenuDefinition(): MenuItem {
    return {
      label: this.lang.t('menu.admin.title'),
      route: '/admin',
      roles: ['admin'],
      children: [
        { label: this.lang.t('menu.admin.dashboard'), route: '/admin' },
        { label: this.lang.t('menu.admin.calendar'), route: '/admin/calendar' },
        { label: this.lang.t('menu.admin.users'), route: '/admin/users' },
        { label: this.lang.t('menu.admin.clients'), route: '/admin/clients' },
        { label: this.lang.t('menu.admin.staff'), route: '/admin/staff' },
        { label: this.lang.t('menu.admin.permissions'), route: '/admin/permissions' },
        { label: this.lang.t('menu.admin.portfolio'), route: '/admin/portfolio' },
        { label: this.lang.t('menu.admin.services'), route: '/admin/servizi' },
        { label: this.lang.t('menu.admin.reviews'), route: '/admin/reviews' },
        { label: this.lang.t('menu.admin.messaging'), route: '/admin/messaging' },
        { label: this.lang.t('menu.admin.events'), route: '/admin/eventi' },
        { label: this.lang.t('menu.admin.billing'), route: '/admin/billing' },
        { label: this.lang.t('menu.admin.bonus'), route: '/admin/bonus' },
        { label: this.lang.t('menu.admin.analytics'), route: '/admin/analytics' },
        { label: this.lang.t('menu.admin.auditLogs'), route: '/admin/audit-logs' },
        { label: this.lang.t('menu.admin.documents'), route: '/admin/documents' },
        { label: this.lang.t('menu.admin.waitlist'), route: '/admin/waitlist' },
        { label: this.lang.t('menu.admin.settings'), route: '/admin/settings' },
        { label: this.lang.t('menu.admin.sectionsVisibility'), route: '/admin/sections-visibility' }
      ]
    };
  }

  getMenuByRole(role: MenuSection): Observable<MenuItem[]> {
    switch (role) {
      case 'client':
        return of(this.cloneMenu(this.buildClientMenu()));
      case 'staff':
        return of(this.cloneMenu(this.buildStaffMenu({
          canManageRoles: false,
          canManageBookings: false,
          canManageProjects: false,
          canManageEvents: false,
          canManageMessages: false
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
    const canManageEvents = user.permissions?.canManageEvents === true;
    const canManageMessages = user.permissions?.['canManageMessages'] === true;
    return of(this.cloneMenu(this.buildStaffMenu({ canManageRoles, canManageBookings, canManageProjects, canManageEvents, canManageMessages })));
  }

  private buildPublicMenu(): MenuItem[] {
    return this.buildPublicMenuItems();
  }

  private buildClientMenu(): MenuItem[] {
    const dashboardMenu = this.filterMenuChildrenByVisibility(this.buildDashboardMenu());
    const publicMenu = this.buildPublicMenuItems();
    return dashboardMenu ? [...publicMenu, dashboardMenu] : [...publicMenu];
  }

  private buildAdminMenu(): MenuItem[] {
    const dashboardMenu = this.filterMenuChildrenByVisibility(this.buildDashboardMenu());
    const adminMenu = this.buildAdminMenuDefinition();
    const filteredChildren = (adminMenu.children ?? []).filter((item) => {
      if (item.route === '/admin/sections-visibility') return true;
      return this.sectionsVisibility.isVisible(item.route);
    });

    const publicMenu = this.buildPublicMenuItems();
    return [
      ...publicMenu,
      ...(dashboardMenu ? [dashboardMenu] : []),
      { ...adminMenu, children: filteredChildren }
    ];
  }

  private buildStaffMenu(flags: { canManageRoles: boolean; canManageBookings: boolean; canManageProjects: boolean; canManageEvents: boolean; canManageMessages: boolean }): MenuItem[] {
    const staffAdminMenu = this.buildStaffAdminMenu(flags);
    const staffClientZoneMenu = this.filterMenuChildrenByVisibility(this.buildStaffClientZoneMenu());
    const publicMenu = this.buildPublicMenuItems();
    return staffAdminMenu
      ? [...publicMenu, ...(staffClientZoneMenu ? [staffClientZoneMenu] : []), staffAdminMenu]
      : [...publicMenu, ...(staffClientZoneMenu ? [staffClientZoneMenu] : [])];
  }

  private buildStaffAdminMenu(flags: { canManageRoles: boolean; canManageBookings: boolean; canManageProjects: boolean; canManageEvents: boolean; canManageMessages: boolean }): MenuItem | null {
    const children: MenuItem[] = [];

    if (flags.canManageBookings) {
      if (this.sectionsVisibility.isVisible('/staff/calendar')) {
        children.push({ label: this.lang.t('menu.staff.calendar'), route: '/staff/calendar' });
      }
    }

    if (flags.canManageProjects) {
      if (this.sectionsVisibility.isVisible('/staff/portfolio')) {
        children.push({ label: this.lang.t('menu.staff.projects'), route: '/staff/portfolio' });
      }
    }

    if (flags.canManageEvents) {
      if (this.sectionsVisibility.isVisible('/staff/eventi')) {
        children.push({ label: this.lang.t('menu.staff.events'), route: '/staff/eventi' });
      }
    }

    if (flags.canManageMessages) {
      if (this.sectionsVisibility.isVisible('/staff/messaging')) {
        children.push({ label: this.lang.t('menu.staff.chat'), route: '/staff/messaging' });
      }
    }

    if (flags.canManageRoles) {
      if (this.sectionsVisibility.isVisible('/staff/clients')) {
        children.push({ label: this.lang.t('menu.staff.clients'), route: '/staff/clients' });
      }
    }

    if (children.length === 0) return null;

    return {
      label: this.lang.t('menu.staff.title'),
      route: '/staff',
      roles: ['staff'],
      children
    };
  }

  private filterMenuChildrenByVisibility(menu: MenuItem): MenuItem | null {
    const children = (menu.children ?? []).filter((child) => this.sectionsVisibility.isVisible(child.route));
    if (!children.length) return null;
    return { ...menu, children };
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
