import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-step-intro',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './step-intro.component.html',
  styleUrl: './step-intro.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepIntroComponent {
  ngOnInit() {
    console.log('intro')
  }
}
