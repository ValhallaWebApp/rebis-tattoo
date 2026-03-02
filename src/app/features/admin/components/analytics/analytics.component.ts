import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import * as XLSX from 'xlsx';
import { MatSelectChange } from '@angular/material/select';
import { MaterialModule } from '../../../../core/modules/material.module';
import {
  AnalyticsFacadeService,
  AnalyticsPeriod,
  AnalyticsExportScope,
  DEFAULT_EXPORT_SCOPES,
  EMPTY_ANALYTICS_VIEW_MODEL
} from './analytics-facade.service';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, MaterialModule, NgxChartsModule],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalyticsComponent {
  private readonly facade = inject(AnalyticsFacadeService);

  protected readonly vm = toSignal(this.facade.vm$, {
    initialValue: EMPTY_ANALYTICS_VIEW_MODEL
  });

  readonly colorScheme = 'vivid' as const;
  readonly periodOptions: ReadonlyArray<{ value: AnalyticsPeriod; label: string }> = [
    { value: 'month', label: 'Mese' },
    { value: 'trimester', label: 'Trimestre' },
    { value: 'quadrimester', label: 'Quadrimestre' },
    { value: 'semester', label: 'Semestre' },
    { value: 'year', label: 'Anno' }
  ];
  readonly sectionOptions = [
    { value: 'overview', label: 'Panoramica' },
    { value: 'revenue', label: 'Fatturato' },
    { value: 'bookings', label: 'Consulenze' },
    { value: 'clients', label: 'Clienti' },
    { value: 'quality', label: 'Qualita' },
    { value: 'styles', label: 'Stili Tattoo' },
    { value: 'operations', label: 'Operativita' }
  ] as const;
  readonly selectedSection = signal<AnalyticsSection>('overview');
  readonly exportOptions: ReadonlyArray<{ value: AnalyticsExportScope; label: string }> = [
    { value: 'kpis', label: 'KPI' },
    { value: 'revenue', label: 'Fatturato' },
    { value: 'bookings', label: 'Consulenze' },
    { value: 'clients', label: 'Clienti' },
    { value: 'styles', label: 'Stili' },
    { value: 'artists', label: 'Artisti' },
    { value: 'utilization', label: 'Utilizzo' },
    { value: 'operations', label: 'Operativita' },
    { value: 'reviews', label: 'Recensioni' }
  ];
  readonly selectedExportScopes = signal<AnalyticsExportScope[]>([...DEFAULT_EXPORT_SCOPES]);

  exportToExcel(): void {
    const excelData = this.facade.buildExcelRows(this.vm(), this.selectedExportScopes());
    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(excelData);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Analytics');
    XLSX.writeFile(wb, 'analytics-rebis.xlsx');
  }

  onPeriodChange(event: MatSelectChange): void {
    const value = String(event.value ?? '').toLowerCase();
    if (this.isPeriodValue(value)) {
      this.facade.setPeriod(value);
    }
  }

  onSectionChange(event: MatSelectChange): void {
    const value = String(event.value ?? '').toLowerCase();
    if (this.isSectionValue(value)) {
      this.selectedSection.set(value);
    }
  }

  onExportScopesChange(event: MatSelectChange): void {
    const values = Array.isArray(event.value) ? event.value : [event.value];
    const selected = values
      .map((item) => String(item ?? '').toLowerCase())
      .filter((value): value is AnalyticsExportScope => this.isExportScopeValue(value));

    this.selectedExportScopes.set(selected.length > 0 ? selected : [...DEFAULT_EXPORT_SCOPES]);
  }

  goToSection(section: AnalyticsSection): void {
    this.selectedSection.set(section);
    document.querySelector('.panel-shell')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  exportSelectionLabel(): string {
    const count = this.selectedExportScopes().length;
    if (count === this.exportOptions.length) return 'Tutto';
    if (count === 0) return 'Nessuno';
    return `${count} selezionati`;
  }

  private isSectionValue(value: string): value is AnalyticsSection {
    return this.sectionOptions.some((item) => item.value === value);
  }

  private isPeriodValue(value: string): value is AnalyticsPeriod {
    return this.periodOptions.some((item) => item.value === value);
  }

  private isExportScopeValue(value: string): value is AnalyticsExportScope {
    return this.exportOptions.some((item) => item.value === value);
  }
}

type AnalyticsSection =
  | 'overview'
  | 'revenue'
  | 'bookings'
  | 'clients'
  | 'quality'
  | 'styles'
  | 'operations';
