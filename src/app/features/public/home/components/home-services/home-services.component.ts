import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, Observable } from 'rxjs';
import { LanguageService } from '../../../../../core/services/language/language.service';
import { Service, ServicesService } from '../../../../../core/services/services/services.service';
import {
  DEFAULT_STUDIO_PROFILE,
  StudioProfileService
} from '../../../../../core/services/studio/studio-profile.service';

@Component({
  selector: 'app-home-services',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-services.component.html',
  styleUrl: './home-services.component.scss'
})
export class HomeServicesComponent {
  readonly services$: Observable<Service[]>;
  private readonly studioProfile = inject(StudioProfileService);
  private readonly profileSig = toSignal(this.studioProfile.getProfile(), {
    initialValue: DEFAULT_STUDIO_PROFILE
  });

  constructor(
    public lang: LanguageService,
    private servicesService: ServicesService
  ) {
    this.services$ = this.servicesService.getServices().pipe(
      map(list => (list ?? []).filter(s => s?.visibile !== false))
    );
  }

  titleOf(s: Service): string {
    return String(s?.name ?? '').trim() || this.lang.t('home.services.fallbackTitle');
  }

  descOf(s: Service): string {
    return String(s?.description ?? '').trim();
  }

  iconFor(s: Service): string {
    const direct = String((s as any)?.icon ?? '').trim();
    if (direct) return direct;
    const cat = String(s?.categoria ?? '').trim().toLowerCase();
    const name = String(s?.name ?? '').trim().toLowerCase();

    if (cat.includes('fine') || name.includes('fine')) return '/home/icon-07-80x80.png';
    if (cat.includes('cover') || name.includes('copertura')) return '/home/icon-03-80x80.png';
    if (cat.includes('design') || name.includes('design')) return '/home/icon-04-80x80.png';
    if (cat.includes('trucco') || name.includes('permanente')) return '/home/icon-05-80x80.png';
    if (cat.includes('su misura') || name.includes('su misura')) return '/home/icon-custom-02.png';
    return '/home/icon-01-80x80.png';
  }

  iconAltOf(s: Service): string {
    return `${this.titleOf(s)} ${this.lang.t('home.services.iconAltSuffix')}`;
  }

  titleText(): string {
    return this.profileSig().homeServicesTitle || this.lang.t('home.services.title');
  }

  subtitleText(): string {
    return this.profileSig().homeServicesSubtitle || this.lang.t('home.services.subtitle');
  }

  emptyTitleText(): string {
    return this.profileSig().homeServicesEmptyTitle || this.lang.t('home.services.emptyTitle');
  }

  emptySubtitleText(): string {
    return this.profileSig().homeServicesEmptySubtitle || this.lang.t('home.services.emptySubtitle');
  }
}
