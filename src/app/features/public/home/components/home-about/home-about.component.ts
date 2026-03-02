import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../../../../core/services/language/language.service';
import {
  DEFAULT_STUDIO_PROFILE,
  StudioProfileService
} from '../../../../../core/services/studio/studio-profile.service';

type ApproachItem = {
  title: string;
  text: string;
};

@Component({
  selector: 'app-home-about',
  standalone:false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-about.component.html',
  styleUrl: './home-about.component.scss'
})
export class HomeAboutComponent {
  private readonly studioProfile = inject(StudioProfileService);
  private readonly profileSig = toSignal(this.studioProfile.getProfile(), {
    initialValue: DEFAULT_STUDIO_PROFILE
  });

  readonly profile = computed(() => this.profileSig());

  readonly clientApproach = computed<readonly ApproachItem[]>(() => {
    const rows = this.lang.get<unknown[]>('home.about.approach');
    if (!Array.isArray(rows)) return [];

    return rows
      .map((entry) => ({
        title: String((entry as { title?: unknown })?.title ?? '').trim(),
        text: String((entry as { text?: unknown })?.text ?? '').trim()
      }))
      .filter((entry) => entry.title.length > 0 || entry.text.length > 0);
  });

  constructor(public lang: LanguageService) {}

}
