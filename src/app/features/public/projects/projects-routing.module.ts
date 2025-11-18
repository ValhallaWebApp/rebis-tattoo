import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProjectListComponent } from './components/project-list/project-list.component';
import { ProjectDetailComponent } from './components/project-detail/project-detail.component';

const routes: Routes = [
  { path: '', component: ProjectListComponent },  // Associa la rotta principale di bookings a BookingListComponent
  // { path: 'detail/:id', component: ProjectDetailComponent }  // Associa la rotta principale di bookings a BookingListComponent

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProjectsRoutingModule { }
