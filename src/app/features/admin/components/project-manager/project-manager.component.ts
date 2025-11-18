import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDrawer } from '@angular/material/sidenav';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Project, ProjectsService } from '../../../../core/services/projects/projects.service';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';
import { Router } from '@angular/router';

@Component({
  selector: 'app-project-management',
  standalone:true,
  imports:[CommonModule,MaterialModule,ReactiveFormsModule],
  templateUrl: './project-manager.component.html',
  styleUrls: ['./project-manager.component.scss']
})
export class ProjectManagementComponent implements OnInit {
 @ViewChild('drawer') drawer!: MatDrawer;

  projects: Project[] = [];
  selectedProject: Project | null = null;
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private projectsService: ProjectsService,
    private router: Router

  ) {}

  ngOnInit(): void {
    this.loadProjects();
    this.initForm();
  }
goToSessions(projectId: string) {
  this.router.navigate(['/admin/session', projectId]);
}
  loadProjects(): void {
    this.projectsService.getProjects().subscribe((list) => {
      this.projects = list;
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
      artistId: [''], // puoi precompilare da user loggato se serve
      utenteCreatore: [''], // idem
      dataProgetto: [new Date().toISOString()],
    });
  }

  openDrawer(project?: Project): void {
    this.selectedProject = project ?? null;
    this.form.reset();

    if (project) this.form.patchValue(project);

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
