import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EventsService, StudioEventOccurrence } from '../../../core/services/events/events.service';
import {
  DEFAULT_STUDIO_PROFILE,
  StudioProfile,
  StudioProfileService
} from '../../../core/services/studio/studio-profile.service';

interface EventiCard {
  readonly badge: string;
  readonly title: string;
  readonly description: string;
  readonly highlights: readonly string[];
  readonly ctaLabel: string;
  readonly ctaRoute: string;
}

interface EventTimelineItem {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly guest: string;
  readonly dateLabel: string;
  readonly slotLabel: string;
  readonly accessLabel: string;
  readonly note: string;
  readonly ctaLabel: string;
  readonly ctaRoute: string;
  readonly eventId: string;
}


@Component({
  selector: 'app-eventi',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './eventi.component.html',
  styleUrls: ['./eventi.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventiComponent {
  private readonly studioProfileService = inject(StudioProfileService);
  private readonly eventsService = inject(EventsService);
  private readonly profileSig = toSignal(this.studioProfileService.getProfile(), {
    initialValue: DEFAULT_STUDIO_PROFILE
  });
  private readonly timelineSig = toSignal(this.eventsService.getPublicTimeline(), {
    initialValue: [] as StudioEventOccurrence[]
  });

  readonly profile = computed<StudioProfile>(() => this.profileSig());
  readonly kicker = computed(() => this.profileSig().homeUpdatesKicker);
  readonly title = computed(() => this.profileSig().homeUpdatesTitle);
  readonly subtitle = computed(() => this.profileSig().homeUpdatesSubtitle);

  readonly cards = computed<readonly EventiCard[]>(() => {
    const profile = this.profileSig();
    return [
      {
        badge: profile.homeEventsBadge,
        title: profile.homeEventsTitle,
        description: profile.homeEventsDescription,
        highlights: this.toHighlights(profile.homeEventsHighlights, DEFAULT_STUDIO_PROFILE.homeEventsHighlights),
        ctaLabel: profile.homeEventsCtaLabel,
        ctaRoute: '/progetti'
      },
      {
        badge: profile.homeCollabBadge,
        title: profile.homeCollabTitle,
        description: profile.homeCollabDescription,
        highlights: this.toHighlights(profile.homeCollabHighlights, DEFAULT_STUDIO_PROFILE.homeCollabHighlights),
        ctaLabel: profile.homeCollabCtaLabel,
        ctaRoute: '/contatti'
      }
    ];
  });

  readonly eventsCard = computed(() => this.cards()[0] ?? null);
  readonly collabCard = computed(() => this.cards()[1] ?? null);
  readonly timelineEvents = computed<readonly EventTimelineItem[]>(() => {
    const timeline = this.timelineSig();
    if (!timeline.length) return [];
    const bucket = new Map<string, StudioEventOccurrence>();
    timeline.forEach((event) => {
      if (!bucket.has(event.eventId)) {
        bucket.set(event.eventId, event);
      }
    });
    return Array.from(bucket.values())
      .slice(0, 10)
      .map((event) => ({
        id: event.id,
        kind: event.type === 'guest' ? 'Guest Spot' : 'Open Day',
        title: event.title,
        guest: event.guestName || event.location || this.profileSig().studioName,
        dateLabel: this.formatDateLabel(event.startDate, event.endDate),
        slotLabel: this.formatSlotLabel(event.startTime, event.endTime),
        accessLabel: event.walkInOnly ? 'Senza prenotazione' : 'Su richiesta',
        note: event.description || 'Dettagli evento in aggiornamento.',
        ctaLabel: this.profileSig().publicEventiTimelineCtaLabel,
        ctaRoute: `/eventi/${event.eventId}`,
        eventId: event.eventId
      }));
  });
  readonly trackByEventId = (_: number, item: EventTimelineItem): string => item.eventId;

  private toHighlights(raw: string, fallback: string): readonly string[] {
    const lines = this.cleanLines(raw);
    if (lines.length > 0) return lines;
    return this.cleanLines(fallback);
  }

  private cleanLines(value: string): string[] {
    return String(value ?? '')
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private formatDateLabel(startDate: string, endDate: string): string {
    if (!startDate) return 'Data in aggiornamento';
    if (!endDate || endDate === startDate) return startDate;
    return `${startDate} - ${endDate}`;
  }

  private formatSlotLabel(startTime: string, endTime: string): string {
    if (!startTime && !endTime) return 'Orario in aggiornamento';
    if (!endTime) return startTime;
    return `${startTime} - ${endTime}`;
  }
}
