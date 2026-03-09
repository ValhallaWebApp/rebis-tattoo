import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { UsersManagementComponent } from './components/users-management/users-management.component';
import { ProjectTrackerComponent } from './components/project-tracker/project-tracker.component';
import { BillingComponent } from './components/billing/billing.component';
import { DocumentsComponent } from './components/documents/documents.component';
import { WaitlistComponent } from './components/waitlist/waitlist.component';
import { MessagingDashboardComponent } from './components/messaging-dashboard/messaging-dashboard.component';
import { AnalyticsComponent } from './components/analytics/analytics.component';
import { StudioSettingsComponent } from './components/studio-settings/studio-settings.component';
import { ReviewListAdminComponent } from './components/review-list-admin/review-list-admin.component';
import { ServicesAdminComponent } from './components/services-admin/services-admin.component';
import { ProjectManagerComponent } from './components/project-manager/project-manager.component';
import { AuditLogsComponent } from './components/audit-logs/audit-logs.component';
import { CalendarComponent } from '../calendar/calendar.component';
import { BonusAdminComponent } from './components/bonus-admin/bonus-admin.component';
import { AdminOnlyGuard } from '../../core/guards/admin-only.guard';
import { RoleManagementGuard } from '../../core/guards/role-management.guard';
import { PermissionsAdminComponent } from './components/permissions-admin/permissions-admin.component';
import { StaffPermissionGuard } from '../../core/guards/staff-permission.guard';
import { StaffDetailAdminComponent } from './components/staff-detail-admin/staff-detail-admin.component';
import { EventsAdminComponent } from './components/events-admin/events-admin.component';
import { SectionsVisibilityAdminComponent } from './components/sections-visibility-admin/sections-visibility-admin.component';

export const ADMIN_ROUTES: Routes = [
  { path: '', component: AdminDashboardComponent },
  { path: 'calendar', component: CalendarComponent, canActivate: [StaffPermissionGuard], data: { permission: 'canManageBookings' } },
  { path: 'users', component: UsersManagementComponent, canActivate: [AdminOnlyGuard], data: { defaultRole: 'client', pageTitle: 'Gestione Utenti' } },
  { path: 'clients', component: UsersManagementComponent, canActivate: [RoleManagementGuard], data: { defaultRole: 'client', pageTitle: 'Gestione Clienti' } },
  { path: 'permissions', component: PermissionsAdminComponent, canActivate: [AdminOnlyGuard] },
  // { path: 'clients/:id', component: ClientDetailComponent },
  { path: 'billing', component: BillingComponent, canActivate: [AdminOnlyGuard] },
  { path: 'documents', component: DocumentsComponent, canActivate: [AdminOnlyGuard] },
  { path: 'waitlist', component: WaitlistComponent, canActivate: [AdminOnlyGuard] },
  { path: 'messaging', component: MessagingDashboardComponent, canActivate: [StaffPermissionGuard], data: { permission: 'canManageMessages' } },
  { path: 'ticket', component: MessagingDashboardComponent, canActivate: [StaffPermissionGuard], data: { permission: 'canManageMessages' } },

  { path: 'portfolio', component: ProjectManagerComponent, canActivate: [StaffPermissionGuard], data: { permission: 'canManageProjects' } },
  { path: 'portfolio/:projectId', component: ProjectTrackerComponent, canActivate: [StaffPermissionGuard], data: { permission: 'canManageProjects' } },
  { path: 'eventi', component: EventsAdminComponent, canActivate: [StaffPermissionGuard], data: { permission: 'canManageEvents' } },

  { path: 'servizi', component: ServicesAdminComponent, canActivate: [AdminOnlyGuard] },

  { path: 'staff', component: UsersManagementComponent, canActivate: [AdminOnlyGuard], data: { defaultRole: 'staff', pageTitle: 'Gestione Staff' } },
  { path: 'staff/:id', component: StaffDetailAdminComponent, canActivate: [AdminOnlyGuard] },
  { path: 'bonus', component: BonusAdminComponent, canActivate: [AdminOnlyGuard] },

  { path: 'analytics', component: AnalyticsComponent, canActivate: [AdminOnlyGuard] },
  { path: 'audit-logs', component: AuditLogsComponent, canActivate: [AdminOnlyGuard] },
  { path: 'settings', component: StudioSettingsComponent, canActivate: [AdminOnlyGuard] },
  { path: 'sections-visibility', component: SectionsVisibilityAdminComponent, canActivate: [AdminOnlyGuard] },
  { path: 'sezioni-visibili', component: SectionsVisibilityAdminComponent, canActivate: [AdminOnlyGuard] },
  { path: 'review-list', component: ReviewListAdminComponent, canActivate: [AdminOnlyGuard] },
  { path: 'reviews', component: ReviewListAdminComponent, canActivate: [AdminOnlyGuard] }
];
