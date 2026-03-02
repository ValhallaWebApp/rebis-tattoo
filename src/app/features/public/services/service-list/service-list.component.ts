import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, Observable } from 'rxjs';
import { MaterialModule } from '../../../../core/modules/material.module';
import { LanguageService } from '../../../../core/services/language/language.service';
import { Service, ServicesService } from '../../../../core/services/services/services.service';
import {
  DEFAULT_STUDIO_PROFILE,
  StudioProfileService
} from '../../../../core/services/studio/studio-profile.service';

@Component({
  selector: 'app-service-list',
  standalone: true,
  imports: [
    CommonModule,
    MaterialModule
  ],
  templateUrl: './service-list.component.html',
  styleUrl: './service-list.component.scss'
})
export class ServiceListComponent {
  readonly services$: Observable<Service[]>;
  private flippedServiceId: string | null = null;
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
    return String(s?.name ?? '').trim() || 'Servizio';
  }

  descOf(s: Service): string {
    return String(s?.description ?? '').trim();
  }

  isFlipped(id: string): boolean {
    return this.flippedServiceId === id;
  }

  toggleFlip(id: string): void {
    this.flippedServiceId = this.flippedServiceId === id ? null : id;
  }

  closeFlip(id: string): void {
    if (this.flippedServiceId === id) {
      this.flippedServiceId = null;
    }
  }

  priceLabelOf(s: Service): string {
    if (s.prezzoDaConcordare) return 'Prezzo su richiesta';
    const price = Number(s.prezzo);
    if (!Number.isFinite(price) || price <= 0) return 'Prezzo su richiesta';
    return `EUR ${Math.round(price)}`;
  }

  durationLabelOf(s: Service): string {
    if (s.durataDaConcordare) return 'Durata su richiesta';
    const duration = Number(s.durata);
    if (!Number.isFinite(duration) || duration <= 0) return 'Durata su richiesta';
    return `${Math.round(duration)} min`;
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
