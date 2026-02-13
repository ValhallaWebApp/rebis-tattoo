import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { map, Observable } from 'rxjs';
import { MaterialModule } from '../../../../core/modules/material.module';
import { LanguageService } from '../../../../core/services/language/language.service';
import { Service, ServicesService } from '../../../../core/services/services/services.service';

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
}
