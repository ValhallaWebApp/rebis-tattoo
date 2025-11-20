import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDrawer } from '@angular/material/sidenav';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Project, ProjectsService } from '../../../../core/services/projects/projects.service';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';
import { Router } from '@angular/router';

@Component({
  selector: 'app-project-management',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './project-manager.component.html',
  styleUrls: ['./project-manager.component.scss'],
})
export class ProjectManagementComponent implements OnInit {
  @ViewChild('drawer') drawer!: MatDrawer;

  projects: Project[] = [];
  filteredProjects: Project[] = [];

  selectedProject: Project | null = null;
  form!: FormGroup;
  filterForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private projectsService: ProjectsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.initFilterForm();
    this.loadProjects();
  }

  goToSessions(projectId: string) {
    this.router.navigate(['/admin/session', projectId]);
  }

  loadProjects(): void {
    this.projectsService.getProjects().subscribe((list) => {
      this.projects = list;
      this.applyFilters();
    });
  }

  initForm(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      genere: [''],
      note: [''],
      numeroSedute: [1],
      show: [true],
      copertine: [[]],
      artistId: [''],
      utenteCreatore: [''],
      dataProgetto: [new Date().toISOString()],
    });
  }

  /** Filtri minimal */
  initFilterForm(): void {
    this.filterForm = this.fb.group({
      name: [''],
      genere: [''],
      show: [''], // '', 'visible', 'hidden'
    });

    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
  }

  applyFilters(): void {
    const { name, genere, show } = this.filterForm.value;

    this.filteredProjects = this.projects.filter((project) => {
      const matchesName =
        !name ||
        project.name.toLowerCase().includes(name.toLowerCase());

      const matchesGenere =
        !genere ||
        (project.genere || '')
          .toLowerCase()
          .includes(genere.toLowerCase());

      const matchesShow =
        !show ||
        (show === 'visible' && project.show) ||
        (show === 'hidden' && !project.show);

      return matchesName && matchesGenere && matchesShow;
    });
  }

  getProjectSessions(project: any): any[] {
    return (project && (project as any).sessions) || [];
  }

  openDrawer(project?: Project): void {
    this.selectedProject = project ?? null;
    this.form.reset({
      name: '',
      genere: '',
      note: '',
      numeroSedute: 1,
      show: true,
      copertine: [],
      artistId: '',
      utenteCreatore: '',
      dataProgetto: new Date().toISOString(),
    });

    if (project) {
      this.form.patchValue(project);
    }

    this.drawer.open();
  }

  closeDrawer(): void {
    this.drawer.close();
  }

  async saveProject(): Promise<void> {
    const data = this.form.value;

    if (this.selectedProject?.id) {
      await this.projectsService.updateProject(this.selectedProject.id, data);
    } else {
      await this.projectsService.addProject(data);
    }

    this.closeDrawer();
  }
}
