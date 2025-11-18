import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectsRoutingModule } from './projects-routing.module';
import { ProjectListComponent } from './components/project-list/project-list.component';
import { ProjectDetailComponent } from './components/project-detail/project-detail.component';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../core/modules/material.module';



@NgModule({
  declarations: [ProjectListComponent, ProjectDetailComponent],
  imports: [
    CommonModule,
    RouterLink,
    ProjectsRoutingModule,
    MaterialModule,
    ReactiveFormsModule
  ]
})
export class ProjectsModule { }
