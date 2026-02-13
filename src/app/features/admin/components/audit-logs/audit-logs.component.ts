import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MaterialModule } from '../../../../core/modules/material.module';
import { AuditLogRecord, AuditLogService } from '../../../../core/services/audit/audit-log.service';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.scss']
})
export class AuditLogsComponent implements OnInit, OnDestroy {
  filterForm!: FormGroup;
  allLogs: AuditLogRecord[] = [];
  filteredLogs: AuditLogRecord[] = [];
  loading = true;
  readonly displayedColumns = ['at', 'action', 'status', 'actor', 'resource', 'target', 'message'];
  private sub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private audit: AuditLogService,
    private ui: UiFeedbackService
  ) {}

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      action: [''],
      actorId: [''],
      status: [''],
      from: [''],
      to: ['']
    });

    this.sub = this.audit.stream(1500).subscribe({
      next: logs => {
        this.allLogs = logs;
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.ui.error('Errore caricamento audit log');
      }
    });

    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
    void this.runRetention();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  applyFilters(): void {
    const { action, actorId, status, from, to } = this.filterForm.value;
    const fromIso = from ? new Date(from).toISOString() : '';
    const toIso = to ? new Date(`${to}T23:59:59`).toISOString() : '';

    this.filteredLogs = this.allLogs.filter(log => {
      const byAction = !action || log.action.toLowerCase().includes(String(action).toLowerCase());
      const byActor = !actorId || String(log.actorId ?? '').toLowerCase().includes(String(actorId).toLowerCase());
      const byStatus = !status || log.status === status;
      const byFrom = !fromIso || log.at >= fromIso;
      const byTo = !toIso || log.at <= toIso;
      return byAction && byActor && byStatus && byFrom && byTo;
    });
  }

  resetFilters(): void {
    this.filterForm.reset({
      action: '',
      actorId: '',
      status: '',
      from: '',
      to: ''
    });
  }

  exportCsv(): void {
    const rows = this.filteredLogs.map(log => ({
      at: log.at,
      action: log.action,
      status: log.status ?? '',
      actorId: log.actorId ?? '',
      actorRole: log.actorRole ?? '',
      resource: log.resource,
      resourceId: log.resourceId ?? '',
      targetUserId: log.targetUserId ?? '',
      message: log.message ?? '',
      meta: JSON.stringify(log.meta ?? {})
    }));

    const headers = Object.keys(rows[0] ?? {
      at: '',
      action: '',
      status: '',
      actorId: '',
      actorRole: '',
      resource: '',
      resourceId: '',
      targetUserId: '',
      message: '',
      meta: ''
    });

    const csv = [
      headers.join(','),
      ...rows.map(row => headers.map(h => this.escapeCsv((row as any)[h])).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.ui.success('CSV esportato');
  }

  private async runRetention(): Promise<void> {
    try {
      const removed = await this.audit.pruneOlderThan(90);
      if (removed > 0) {
        this.ui.info(`Retention audit: rimossi ${removed} log vecchi`);
      }
    } catch {
      this.ui.warn('Retention audit non completata');
    }
  }

  private escapeCsv(value: unknown): string {
    const str = String(value ?? '');
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
    }
}
