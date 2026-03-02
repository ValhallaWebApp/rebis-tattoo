import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSelectChange } from '@angular/material/select';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { AnalyticsComponent } from './analytics.component';
import {
  AnalyticsFacadeService,
  DEFAULT_EXPORT_SCOPES,
  EMPTY_ANALYTICS_VIEW_MODEL
} from './analytics-facade.service';

class AnalyticsFacadeStub {
  readonly vm$ = of(EMPTY_ANALYTICS_VIEW_MODEL);
  readonly setPeriod = jasmine.createSpy('setPeriod');
  readonly buildExcelRows = jasmine.createSpy('buildExcelRows').and.returnValue([['Nome', 'Valore']]);
}

describe('AnalyticsComponent', () => {
  let component: AnalyticsComponent;
  let fixture: ComponentFixture<AnalyticsComponent>;
  let facade: AnalyticsFacadeStub;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalyticsComponent, NoopAnimationsModule],
      providers: [{ provide: AnalyticsFacadeService, useClass: AnalyticsFacadeStub }]
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsComponent);
    component = fixture.componentInstance;
    facade = TestBed.inject(AnalyticsFacadeService) as unknown as AnalyticsFacadeStub;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should delegate period changes to facade', () => {
    component.onPeriodChange({ value: 'year' } as MatSelectChange);
    expect(facade.setPeriod).toHaveBeenCalledWith('year');
  });

  it('should change selected section from filter', () => {
    component.onSectionChange({ value: 'quality' } as MatSelectChange);
    expect(component.selectedSection()).toBe('quality');
  });

  it('should update export scopes from multi select', () => {
    component.onExportScopesChange({ value: ['kpis', 'revenue', 'reviews'] } as MatSelectChange);
    expect(component.selectedExportScopes()).toEqual(['kpis', 'revenue', 'reviews']);
  });

  it('should restore default export scopes when empty', () => {
    component.onExportScopesChange({ value: [] } as MatSelectChange);
    expect(component.selectedExportScopes()).toEqual([...DEFAULT_EXPORT_SCOPES]);
  });

  it('should switch section from quick action', () => {
    component.goToSection('operations');
    expect(component.selectedSection()).toBe('operations');
  });
});
