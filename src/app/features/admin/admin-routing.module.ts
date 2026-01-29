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
import { SessionManagerComponent } from './components/session-manager/session-manager.component';
import { Calendar } from '@fullcalendar/core/index.js';
import { CalendarComponent } from '../calendar/calendar.component';
import { ProjectDetailComponent } from '../public/projects/components/project-detail/project-detail.component';

const routes: Routes = [
  { path: '', component: AdminDashboardComponent },
  { path: 'calendar', component: CalendarComponent },
  { path: 'clients', component: ClientsListComponent },
  // { path: 'clients/:id', component: ClientDetailComponent },
  { path: 'billing', component: BillingComponent },
  { path: 'documents', component: DocumentsComponent },
  { path: 'waitlist', component: WaitlistComponent },
  { path: 'messaging', component: MessagingDashboardComponent },

  { path: 'portfolio', component: ProjectManagerComponent },
  { path: 'portfolio/:projectId', component: ProjectTrackerComponent },

  { path: 'session', component: SessionManagerComponent },
  { path: 'session/:projectId', component: SessionManagerComponent },

  { path: 'servizi', component: ServicesAdminComponent },

  { path: 'staff', component: StaffMembersAdminComponent },

  { path: 'analytics', component: AnalyticsComponent },
  { path: 'settings', component: StudioSettingsComponent },
  { path: 'review-list', component: ReviewListAdminComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule {}
