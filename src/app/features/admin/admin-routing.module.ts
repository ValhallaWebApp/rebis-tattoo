import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { CalendarAdminComponent } from './components/calendar-admin/calendar-admin.component';
import { ClientsListComponent } from './components/clients-list/clients-list.component';
import { ClientDetailComponent } from './components/client-detail/client-detail.component';
import { ProjectTrackerComponent } from './components/project-tracker/project-tracker.component';
import { BillingComponent } from './components/billing/billing.component';
import { DocumentsComponent } from './components/documents/documents.component';
import { WaitlistComponent } from './components/waitlist/waitlist.component';
import { MessagingDashboardComponent } from './components/messaging-dashboard/messaging-dashboard.component';
import { AnalyticsComponent } from './components/analytics/analytics.component';
import { StudioSettingsComponent } from './components/studio-settings/studio-settings.component';
import { ReviewListAdminComponent } from './components/review-list-admin/review-list-admin.component';
import { ServicesAdminComponent } from './components/services-admin/services-admin.component';
import { StaffMembersAdminComponent } from './components/staff-members-admin/staff-members-admin.component';
import { ProjectManagerComponent } from './components/project-manager/project-manager.component';
import { AuditLogsComponent } from './components/audit-logs/audit-logs.component';
import { Calendar } from '@fullcalendar/core/index.js';
import { CalendarComponent } from '../calendar/calendar.component';
import { ProjectDetailComponent } from '../public/projects/components/project-detail/project-detail.component';
import { BonusAdminComponent } from './components/bonus-admin/bonus-admin.component';
import { AdminOnlyGuard } from '../../core/guards/admin-only.guard';
import { RoleManagementGuard } from '../../core/guards/role-management.guard';
import { PermissionsAdminComponent } from './components/permissions-admin/permissions-admin.component';
import { StaffPermissionGuard } from '../../core/guards/staff-permission.guard';
import { StaffDetailAdminComponent } from './components/staff-detail-admin/staff-detail-admin.component';

const routes: Routes = [
  { path: '', component: AdminDashboardComponent },
  { path: 'calendar', component: CalendarComponent, canActivate: [StaffPermissionGuard], data: { permission: 'canManageBookings' } },
  { path: 'clients', component: ClientsListComponent, canActivate: [RoleManagementGuard] },
  { path: 'permissions', component: PermissionsAdminComponent, canActivate: [AdminOnlyGuard] },
  // { path: 'clients/:id', component: ClientDetailComponent },
  { path: 'billing', component: BillingComponent, canActivate: [AdminOnlyGuard] },
  { path: 'documents', component: DocumentsComponent, canActivate: [AdminOnlyGuard] },
  { path: 'waitlist', component: WaitlistComponent, canActivate: [AdminOnlyGuard] },
  { path: 'messaging', component: MessagingDashboardComponent, canActivate: [AdminOnlyGuard] },
  { path: 'ticket', component: MessagingDashboardComponent, canActivate: [AdminOnlyGuard] },

  { path: 'portfolio', component: ProjectManagerComponent, canActivate: [StaffPermissionGuard], data: { permission: 'canManageProjects' } },
  { path: 'portfolio/:projectId', component: ProjectTrackerComponent, canActivate: [StaffPermissionGuard], data: { permission: 'canManageProjects' } },

  { path: 'servizi', component: ServicesAdminComponent, canActivate: [AdminOnlyGuard] },

  { path: 'staff', component: StaffMembersAdminComponent, canActivate: [AdminOnlyGuard] },
  { path: 'staff/:id', component: StaffDetailAdminComponent, canActivate: [AdminOnlyGuard] },
  { path: 'bonus', component: BonusAdminComponent, canActivate: [AdminOnlyGuard] },

  { path: 'analytics', component: AnalyticsComponent, canActivate: [AdminOnlyGuard] },
  { path: 'audit-logs', component: AuditLogsComponent, canActivate: [AdminOnlyGuard] },
  { path: 'settings', component: StudioSettingsComponent, canActivate: [AdminOnlyGuard] },
  { path: 'review-list', component: ReviewListAdminComponent, canActivate: [AdminOnlyGuard] }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule {}
