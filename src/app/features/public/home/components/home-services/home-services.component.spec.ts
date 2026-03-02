import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { HomeServicesComponent } from './home-services.component';
import { LanguageService } from '../../../../../core/services/language/language.service';
import { ServicesService } from '../../../../../core/services/services/services.service';

describe('HomeServicesComponent', () => {
  let component: HomeServicesComponent;
  let fixture: ComponentFixture<HomeServicesComponent>;

  const servicesServiceStub = {
    getServices: () => of([])
  };

  const languageServiceStub = {
    t: (path: string) => {
      if (path === 'home.services.fallbackTitle') return 'Service';
      if (path === 'home.services.iconAltSuffix') return 'icon';
      return path;
    },
    get: () => undefined
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HomeServicesComponent],
      providers: [
        { provide: ServicesService, useValue: servicesServiceStub },
        { provide: LanguageService, useValue: languageServiceStub }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeServicesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should use i18n fallback title and alt suffix', () => {
    const item = {
      id: '1',
      name: '',
      description: '',
      categoria: '',
      prezzo: 0,
      durata: 0,
      visibile: true,
      createdAt: 0,
      updatedAt: 0,
      creatoreId: 'admin'
    };

    expect(component.titleOf(item)).toBe('Service');
    expect(component.iconAltOf(item)).toBe('Service icon');
  });
});
