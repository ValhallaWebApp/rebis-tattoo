import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';

/* Angular Material */
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule }    from '@angular/material/icon';
import { MatButtonModule }  from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

/* date-fns per formattare il titolo */
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import { MaterialModule } from '../../../../core/modules/material.module';

/** Tipi accettati */
export type CalendarView = 'day' | 'week' | 'month';

@Component({
  selector: 'app-calendar-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    /* Material */
 MaterialModule
  ],
  templateUrl: './calendar-toolbar.component.html',
  styleUrls: ['./calendar-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarToolbarComponent {

  /* ---------- Input ----------- */
  @Input({ required: true }) currentDate!: Date;
  @Input({ required: true }) view!: CalendarView;

  /* ---------- Output ---------- */
  /** -1 = precede, +1 = segue (la shell decide la logica di salto) */
  @Output() navigate   = new EventEmitter<number>();
  @Output() viewChange = new EventEmitter<CalendarView>();

  /* ---------- Helpers ---------- */

  /** Titolo calcolato in base alla vista */
  get title(): string {
    if (!this.currentDate) return '';

    switch (this.view) {
      case 'day':
        // es. “Sabato 5 luglio 2025”
        return format(this.currentDate, 'PPPP', { locale: it });

      case 'week': {
        // es. “30 giu – 6 lug 2025”
        const start = startOfWeek(this.currentDate, { weekStartsOn: 1 });
        const end   = endOfWeek(this.currentDate,   { weekStartsOn: 1 });
        const fmt   = (d: Date) => format(d, 'd LLL', { locale: it });
        return `${fmt(start)} – ${fmt(end)} ${format(end, 'yyyy', { locale: it })}`;
      }

      case 'month':
      default:
        // es. “Luglio 2025”
        return format(this.currentDate, 'LLLL yyyy', { locale: it });
    }
  }
/** Formato da passare alla Angular DatePipe  */
get titleFormat(): string {
  switch (this.view) {
    case 'day':   return 'PPPP';                 // Sabato, 5 luglio 2025
    case 'week':  return "'Settimana' ww";       // Settimana 27
    case 'month': return 'LLLL yyyy';            // Luglio 2025
    default:      return 'PPP';
  }
}

  /* ---------- UI handlers ---------- */
  prev(): void { this.navigate.emit(-1); }
  next(): void { this.navigate.emit(1); }
}
