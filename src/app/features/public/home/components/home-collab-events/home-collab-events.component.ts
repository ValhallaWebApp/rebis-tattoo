import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../../../../core/services/language/language.service';
import {
  DEFAULT_STUDIO_PROFILE,
  StudioProfileService
} from '../../../../../core/services/studio/studio-profile.service';

interface StudioUpdateCard {
  readonly badge: string;
  readonly title: string;
  readonly description: string;
  readonly highlights: readonly string[];
  readonly ctaLabel: string;
  readonly ctaRoute: string;
}

@Component({
  selector: 'app-home-collab-events',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-collab-events.component.html',
  styleUrl: './home-collab-events.component.scss'
})
export class HomeCollabEventsComponent {
  private readonly studioProfileService = inject(StudioProfileService);
  private readonly lang = inject(LanguageService);
  private readonly profileSig = toSignal(this.studioProfileService.getProfile(), {
    initialValue: DEFAULT_STUDIO_PROFILE
  });

  readonly kicker = computed(() => this.profileSig().homeUpdatesKicker);
  readonly title = computed(() => this.profileSig().homeUpdatesTitle);
  readonly subtitle = computed(() => this.profileSig().homeUpdatesSubtitle);

  readonly cards = computed<readonly StudioUpdateCard[]>(() => {
    const profile = this.profileSig();
    return [
      {
        badge: profile.homeCollabBadge,
        title: profile.homeCollabTitle,
        description: profile.homeCollabDescription,
        highlights: this.toHighlights(profile.homeCollabHighlights, DEFAULT_STUDIO_PROFILE.homeCollabHighlights),
        ctaLabel: profile.homeCollabCtaLabel,
        ctaRoute: '/contatti'
      },
      {
        badge: profile.homeEventsBadge,
        title: profile.homeEventsTitle,
        description: profile.homeEventsDescription,
        highlights: this.toHighlights(profile.homeEventsHighlights, DEFAULT_STUDIO_PROFILE.homeEventsHighlights),
        ctaLabel: profile.homeEventsCtaLabel,
        ctaRoute: '/eventi'
      }
    ];
  });

  private toHighlights(raw: string, fallback: string): readonly string[] {
    const lines = this.cleanLines(raw);
    if (lines.length > 0) return lines;
    const fallbackLines = this.cleanLines(fallback);
    return fallbackLines.length > 0
      ? fallbackLines
      : [this.lang.t('home.collabEvents.fallbackHighlight')];
  }

  private cleanLines(value: string): string[] {
    return String(value ?? '')
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean);
  }
}
