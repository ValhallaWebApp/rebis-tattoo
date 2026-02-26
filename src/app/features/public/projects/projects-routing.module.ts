import { Routes } from '@angular/router';

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
