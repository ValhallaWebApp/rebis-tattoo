import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../../../../core/services/language/language.service';
import {
  DEFAULT_STUDIO_PROFILE,
  StudioProfileService
} from '../../../../../core/services/studio/studio-profile.service';

@Component({
  selector: 'app-home-hero',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-hero.component.html',
  styleUrls: ['./home-hero.component.scss']
})
export class HomeHeroComponent {
  private readonly studioProfile = inject(StudioProfileService);
  private readonly profileSig = toSignal(this.studioProfile.getProfile(), {
    initialValue: DEFAULT_STUDIO_PROFILE
  });

  readonly hero = computed(() => this.profileSig());
  readonly heroBackgroundUrl = computed(() => String(this.profileSig().homeHeroBackgroundImageUrl ?? '').trim());

  constructor(public lang: LanguageService) {}
}

