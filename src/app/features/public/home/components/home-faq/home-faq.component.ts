import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { toSignal } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../../../../core/services/language/language.service';
import {
  DEFAULT_STUDIO_PROFILE,
  StudioProfileService
} from '../../../../../core/services/studio/studio-profile.service';

type HomeFaqItem = {
  question: string;
  answer: string;
};

@Component({
  selector: 'app-home-faq',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-faq.component.html',
  styleUrl: './home-faq.component.scss',
  animations: [
    trigger('faqExpand', [
      state('collapsed', style({ height: '0px', opacity: 0, marginTop: '0px' })),
      state('expanded', style({ height: '*', opacity: 1, marginTop: '0.75rem' })),
      transition('collapsed <=> expanded', animate('260ms cubic-bezier(0.22, 1, 0.36, 1)'))
    ])
  ]
})
export class HomeFaqComponent {
  private readonly studioProfile = inject(StudioProfileService);
  private readonly profileSig = toSignal(this.studioProfile.getProfile(), {
    initialValue: DEFAULT_STUDIO_PROFILE
  });

  readonly faqs = computed<readonly HomeFaqItem[]>(() => {
    const rows = this.lang.get<unknown[]>('home.faq');
    if (!Array.isArray(rows)) return [];

    return rows
      .map((entry) => ({
        question: String((entry as { question?: unknown })?.question ?? '').trim(),
        answer: String((entry as { answer?: unknown })?.answer ?? '').trim()
      }))
      .filter((entry) => entry.question.length > 0 && entry.answer.length > 0);
  });

  activeIndex: number | null = null;

  constructor(public lang: LanguageService) {}

  titleText(): string {
    return this.profileSig().homeFaqTitle || this.lang.t('home.faqTitle');
  }

  toggle(index: number): void {
    this.activeIndex = this.activeIndex === index ? null : index;
  }
}

