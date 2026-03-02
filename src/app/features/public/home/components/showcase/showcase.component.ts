import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../../../../core/services/language/language.service';
import {
  DEFAULT_STUDIO_PROFILE,
  StudioProfileService
} from '../../../../../core/services/studio/studio-profile.service';

@Component({
  selector: 'app-showcase',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './showcase.component.html',
  styleUrl: './showcase.component.scss'
})
export class ShowcaseComponent {
  private readonly studioProfile = inject(StudioProfileService);
  private readonly profileSig = toSignal(this.studioProfile.getProfile(), {
    initialValue: DEFAULT_STUDIO_PROFILE
  });

 constructor(public lang: LanguageService) {
 }

 titleText(): string {
   return this.profileSig().homeShowcaseTitle || this.lang.t('home.showcase.title');
 }

 subtitleText(): string {
   return this.profileSig().homeShowcaseSubtitle || this.lang.t('home.showcase.subtitle');
 }

 descriptionText(): string {
   return this.profileSig().homeShowcaseDescription || this.lang.t('home.showcase.description');
 }

 ctaText(): string {
   return this.profileSig().homeShowcaseCta || this.lang.t('home.showcase.cta');
 }
}

