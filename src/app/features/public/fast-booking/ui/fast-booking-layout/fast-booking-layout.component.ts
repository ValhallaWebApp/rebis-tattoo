import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FastBookingStore } from '../../state/fast-booking-store.service';

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
  constructor(public store: FastBookingStore) {
  this.store.hydrateFromHomeSeed();
}

}
