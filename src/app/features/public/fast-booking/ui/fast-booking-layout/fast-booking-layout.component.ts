import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-fast-booking-layout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fast-booking-layout.component.html',
  styleUrl: './fast-booking-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FastBookingLayoutComponent {
  /** opzionale: titolo piccolo in alto */
  @Input() title = 'REBIS TATTOO';
}
