import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-project-detail',
  standalone: false,
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.scss'
})
export class ProjectDetailComponent {
  @Input() project: { id: number; title: string; description: string; } | undefined;

}
