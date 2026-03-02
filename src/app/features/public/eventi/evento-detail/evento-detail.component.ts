import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, startWith } from 'rxjs';
import { EventsService, StudioEventOccurrence } from '../../../../core/services/events/events.service';
import {
  DEFAULT_STUDIO_PROFILE,
  StudioProfile,
  StudioProfileService
} from '../../../../core/services/studio/studio-profile.service';

interface TimelineState {
  readonly loaded: boolean;
  readonly items: readonly StudioEventOccurrence[];
}

interface EventPreview {
  readonly eventId: string;
  readonly title: string;
  readonly kind: string;
  readonly dateLabel: string;
  readonly slotLabel: string;
  readonly locationLabel: string;
  readonly recurringLabel: string | null;
  readonly route: string;
}

@Component({
  selector: 'app-evento-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './evento-detail.component.html',
  styleUrls: ['./evento-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventoDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly eventsService = inject(EventsService);
  private readonly studioProfileService = inject(StudioProfileService);

  private readonly eventIdSig = toSignal(
    this.route.paramMap.pipe(map((params) => String(params.get('eventId') ?? '').trim())),
    { initialValue: '' }
  );

  private readonly timelineStateSig = toSignal(
    this.eventsService.getPublicTimeline().pipe(
      map((items) => ({ loaded: true, items }) as TimelineState),
      startWith({ loaded: false, items: [] as StudioEventOccurrence[] } as TimelineState)
    ),
    { initialValue: { loaded: false, items: [] as StudioEventOccurrence[] } as TimelineState }
  );

  private readonly profileSig = toSignal(this.studioProfileService.getProfile(), {
    initialValue: DEFAULT_STUDIO_PROFILE
  });

  readonly profile = computed<StudioProfile>(() => this.profileSig());
  readonly loading = computed(() => !this.timelineStateSig().loaded);

  readonly occurrences = computed<readonly StudioEventOccurrence[]>(() => {
    const eventId = this.eventIdSig();
    if (!eventId) return [];
    return this.timelineStateSig()
      .items
      .filter((item) => item.eventId === eventId)
      .sort((a, b) => this.toTimestamp(a.startDate, a.startTime) - this.toTimestamp(b.startDate, b.startTime));
  });

  readonly event = computed<StudioEventOccurrence | null>(() => this.occurrences()[0] ?? null);
  readonly notFound = computed(() => !this.loading() && !this.event());
  readonly kindLabel = computed(() => (this.event()?.type === 'guest' ? 'Guest Spot' : 'Open Day'));
  readonly accessLabel = computed(() => (this.event()?.walkInOnly ? 'Accesso libero' : 'Prenotazione consigliata'));
  readonly eventDateRangeLabel = computed(() => {
    const items = this.occurrences();
    if (!items.length) return 'Date in aggiornamento';
    const first = items[0];
    const last = items[items.length - 1];
    if (first.startDate === last.startDate) return this.formatDate(first.startDate);
    return `${this.formatDate(first.startDate)} - ${this.formatDate(last.startDate)}`;
  });

  readonly trackByOccurrence = (_: number, item: StudioEventOccurrence): string => item.id;
  readonly trackByEventPreview = (_: number, item: EventPreview): string => item.eventId;

  private readonly groupedTimeline = computed(() => {
    const mapByEvent = new Map<string, StudioEventOccurrence[]>();
    const items = [...this.timelineStateSig().items].sort(
      (a, b) => this.toTimestamp(a.startDate, a.startTime) - this.toTimestamp(b.startDate, b.startTime)
    );

    for (const item of items) {
      const key = String(item.eventId ?? '').trim();
      if (!key) continue;
      const bucket = mapByEvent.get(key) ?? [];
      bucket.push(item);
      mapByEvent.set(key, bucket);
    }

    return Array.from(mapByEvent.entries()).map(([eventId, occurrences]) => ({ eventId, occurrences }));
  });

  readonly nearbyEvents = computed<readonly EventPreview[]>(() => {
    const currentId = this.eventIdSig();
    const currentFirst = this.occurrences()[0];
    if (!currentId || !currentFirst) return [];

    const anchorTs = this.toTimestamp(currentFirst.startDate, currentFirst.startTime);

    return this.groupedTimeline()
      .filter((group) => group.eventId !== currentId)
      .map((group) => {
        const nearest = this.pickNearestOccurrence(group.occurrences, anchorTs);
        const ts = this.toTimestamp(nearest.startDate, nearest.startTime);
        return {
          distance: Math.abs(ts - anchorTs),
          ts,
          preview: this.toEventPreview(group.eventId, group.occurrences, nearest)
        };
      })
      .sort((a, b) => (a.distance - b.distance) || (a.ts - b.ts))
      .slice(0, 4)
      .map((row) => row.preview);
  });

  readonly recurringEvents = computed<readonly EventPreview[]>(() => {
    const currentId = this.eventIdSig();
    const now = Date.now();

    return this.groupedTimeline()
      .filter((group) => group.eventId !== currentId && group.occurrences.length > 1)
      .map((group) => {
        const nextOccurrence = this.pickUpcomingOccurrence(group.occurrences, now) ?? group.occurrences[0];
        const ts = this.toTimestamp(nextOccurrence.startDate, nextOccurrence.startTime);
        return {
          ts,
          upcoming: ts >= now,
          preview: this.toEventPreview(group.eventId, group.occurrences, nextOccurrence)
        };
      })
      .sort((a, b) => {
        if (a.upcoming !== b.upcoming) return a.upcoming ? -1 : 1;
        return a.ts - b.ts;
      })
      .slice(0, 6)
      .map((row) => row.preview);
  });

  formatOccurrenceDate(event: StudioEventOccurrence): string {
    if (!event.endDate || event.endDate === event.startDate) return this.formatDate(event.startDate);
    return `${this.formatDate(event.startDate)} - ${this.formatDate(event.endDate)}`;
  }

  formatOccurrenceSlot(startTime: string, endTime: string): string {
    if (!startTime && !endTime) return 'Orario da confermare';
    if (!endTime) return startTime;
    return `${startTime} - ${endTime}`;
  }

  private toEventPreview(
    eventId: string,
    occurrences: readonly StudioEventOccurrence[],
    occurrence: StudioEventOccurrence
  ): EventPreview {
    const recurringLabel = occurrences.length > 1 ? `Ricorrente - ${occurrences.length} date` : null;
    return {
      eventId,
      title: occurrence.title,
      kind: occurrence.type === 'guest' ? 'Guest Spot' : 'Open Day',
      dateLabel: this.formatOccurrenceDate(occurrence),
      slotLabel: this.formatOccurrenceSlot(occurrence.startTime, occurrence.endTime),
      locationLabel: occurrence.location || occurrence.guestName || this.profileSig().studioName,
      recurringLabel,
      route: `/eventi/${eventId}`
    };
  }

  private pickNearestOccurrence(
    occurrences: readonly StudioEventOccurrence[],
    anchorTs: number
  ): StudioEventOccurrence {
    return occurrences.reduce((best, current) => {
      const currentDelta = Math.abs(this.toTimestamp(current.startDate, current.startTime) - anchorTs);
      const bestDelta = Math.abs(this.toTimestamp(best.startDate, best.startTime) - anchorTs);
      return currentDelta < bestDelta ? current : best;
    }, occurrences[0]);
  }

  private pickUpcomingOccurrence(
    occurrences: readonly StudioEventOccurrence[],
    nowTs: number
  ): StudioEventOccurrence | null {
    const upcoming = occurrences.filter(
      (item) => this.toTimestamp(item.startDate, item.startTime) >= nowTs
    );
    if (!upcoming.length) return null;
    return upcoming.sort(
      (a, b) => this.toTimestamp(a.startDate, a.startTime) - this.toTimestamp(b.startDate, b.startTime)
    )[0];
  }

  private formatDate(ymd: string): string {
    if (!ymd) return 'Data da confermare';
    const date = new Date(`${ymd}T12:00:00`);
    if (Number.isNaN(date.getTime())) return ymd;
    return date.toLocaleDateString('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  private toTimestamp(date: string, time: string): number {
    const safeTime = /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(time ?? '').trim()) ? time : '00:00';
    const parsed = new Date(`${date}T${safeTime}:00`);
    if (Number.isNaN(parsed.getTime())) return 0;
    return parsed.getTime();
  }
}
