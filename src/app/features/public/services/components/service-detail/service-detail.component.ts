import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-service-detail',
  standalone: false,
  templateUrl: './service-detail.component.html',
  styleUrl: './service-detail.component.scss'
})
export class ServiceDetailComponent {
  @Input() service: { id: number; name: string; description: string; } | undefined;

}
