import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProjectDetailComponent } from './components/project-detail/project-detail.component';
import { ProjectListComponent } from './components/project-list/project-list.component';

export const PROJECTS_ROUTES: Routes = [
  // /progetti
  {
    path: '',
    loadComponent: () =>
      import('./components/project-list/project-list.component')
        .then(m => m.ProjectListComponent),
  },

  // /progetti/:artistId
  {
    path: ':artistId',
    loadComponent: () =>
      import('./components/project-list/project-list.component')
        .then(m => m.ProjectListComponent),
  },
];
