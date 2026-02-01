import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';

import { UiArtist, UiCalendarEvent } from '../../models';
import { toDateKey } from '../../utils';

export type AdminActionType =
  | 'open'
  | 'edit'
  | 'confirm'
  | 'pay'
  | 'start'
  | 'complete'
  | 'cancel'
  | 'no_show'
  | 'reschedule';

export interface AdminActionPayload {
  type: AdminActionType;
  event: UiCalendarEvent;
}

export interface AgendaItem extends UiCalendarEvent {
  hh: string;
  mm: string;
  range: string;
  titleUi: string;
  subtitleUi: string;
}

export interface AgendaBlock {
  artistId: string;
  artistName: string;
  items: AgendaItem[];
}

@Component({
  selector: 'app-day-view',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './day-view.component.html',
  styleUrls: ['./day-view.component.scss'],
})
export class DayViewComponent {
  @Input({ required: true }) date!: Date;
  @Input({ required: true }) artists: UiArtist[] = [];
  @Input({ required: true }) events: UiCalendarEvent[] = [];

  /** il parent controlla la data: qui emettiamo solo la nuova */
  @Output() dateChange = new EventEmitter<Date>();

  @Output() createFromSlot = new EventEmitter<{ artistId: string; startISO: string; endISO: string; durationMinutes: number }>();
  @Output() editEvent = new EventEmitter<UiCalendarEvent>();
  @Output() action = new EventEmitter<AdminActionPayload>();

  readonly startHour = 8;
  readonly endHour = 20;
  readonly stepMinutes = 30;
  readonly defaultDuration = 60;

  // ===========================================================================
  // UI STATE (richiesto dal template)
  // ===========================================================================
  readonly q = signal('');
  readonly viewMode = signal<'agenda' | 'board' | 'list'>('agenda');

  readonly artistIds = signal<string[]>([]); // vuoto => tutti
  readonly statuses = signal<string[]>([]);  // vuoto => tutte

  readonly statusOptions: string[] = [
    'draft',
    'pending',
    'confirmed',
    'paid',
    'in_progress',
    'completed',
    'cancelled',
    'no_show',
  ];

  private readonly openArtistIds = signal<Set<string>>(new Set());

  // ===========================================================================
  // DATE / TOPBAR
  // ===========================================================================
  readonly dayKey = computed(() => toDateKey(this.date));

  viewDate() {
    return this.date;
  }

  prevDay(): void {
    const d = new Date(this.date);
    d.setDate(d.getDate() - 1);
    this.dateChange.emit(d);
  }

  nextDay(): void {
    const d = new Date(this.date);
    d.setDate(d.getDate() + 1);
    this.dateChange.emit(d);
  }

  goToday(): void {
    this.dateChange.emit(new Date());
  }

  setQ(v: string): void {
    this.q.set(v ?? '');
  }

  setViewMode(v: any): void {
    const vv = String(v || 'agenda') as any;
    if (vv === 'agenda' || vv === 'board' || vv === 'list') this.viewMode.set(vv);
    else this.viewMode.set('agenda');
  }

  setArtistIds(ids: any): void {
    this.artistIds.set((Array.isArray(ids) ? ids : []).map(String));
  }

  setStatuses(st: any): void {
    this.statuses.set((Array.isArray(st) ? st : []).map(String));
  }

  toggleArtist(artistId: string): void {
    const id = String(artistId);
    const next = new Set(this.openArtistIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.openArtistIds.set(next);
  }

  isArtistOpen(artistId: string): boolean {
    return this.openArtistIds().has(String(artistId));
  }

  createNew(): void {
    const first = this.artists?.[0];
    if (!first) return;
    this.onClickSlot(String(first.id), this.startHour * 60);
  }

  // ===========================================================================
  // DATA NORMALIZATION / AGENDA
  // ===========================================================================
  readonly artistNameById = computed(() => {
    const m = new Map<string, string>();
    for (const a of this.artists || []) m.set(String(a.id), a.name);
    return m;
  });

  readonly dayItems = computed<AgendaItem[]>(() => {
    const key = this.dayKey();
    const nameMap = this.artistNameById();

    const q = this.q().trim().toLowerCase();
    const artistFilter = new Set((this.artistIds() || []).map(String));
    const statusFilter = new Set((this.statuses() || []).map(String));

    return (this.events || [])
      .filter(e => {
        if (this.toDayKeyLocal(e.start) !== key) return false;

        const aid = String((e as any).artistId ?? '');
        if (artistFilter.size && !artistFilter.has(aid)) return false;

        const st = String((e as any).status ?? '');
        if (statusFilter.size && !statusFilter.has(st)) return false;

        if (q) {
          const hay = [
            String((e as any).title ?? ''),
            String((e as any).notes ?? ''),
            String((e as any).clientName ?? ''),
            String((e as any).clientLabel ?? ''),
          ].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }

        return true;
      })
      .map(e => this.toAgendaItem(e, nameMap))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  });

  private readonly kpiTodaySig = computed(() => {
    const items = this.dayItems();
    const byStatus = (s: string) => items.filter(i => String((i as any).status ?? '') === s).length;
    return {
      total: items.length,
      pending: byStatus('pending') + byStatus('draft'),
      confirmed: byStatus('confirmed'),
      paid: byStatus('paid'),
      inProgress: byStatus('in_progress'),
    };
  });

  kpiToday() {
    return this.kpiTodaySig();
  }

  readonly agendaBlocks = computed<AgendaBlock[]>(() => {
    const nameMap = this.artistNameById();

    const groups = new Map<string, AgendaItem[]>();
    for (const it of this.dayItems()) {
      const aid = String(it.artistId ?? '');
      if (!aid) continue;
      if (!groups.has(aid)) groups.set(aid, []);
      groups.get(aid)!.push(it);
    }

    const blocks: AgendaBlock[] = [];
    for (const a of this.artists || []) {
      const aid = String(a.id);
      const items = groups.get(aid) ?? [];
      blocks.push({
        artistId: aid,
        artistName: a.name,
        items: items.sort((x, y) => new Date(x.start).getTime() - new Date(y.start).getTime()),
      });
    }

    for (const [aid, items] of groups.entries()) {
      if (!blocks.some(b => b.artistId === aid)) {
        blocks.push({
          artistId: aid,
          artistName: nameMap.get(aid) ?? `Artista ${aid}`,
          items,
        });
      }
    }

    return blocks;
  });

  trackByArtist = (_: number, b: AgendaBlock) => b.artistId;
  trackById = (_: number, it: AgendaItem) => it.id;

  // ===========================================================================
  // SLOT / ACTIONS
  // ===========================================================================
  onClickSlot(artistId: string, minutes: number) {
    const d = new Date(this.date);
    d.setHours(0, 0, 0, 0);
    d.setMinutes(minutes);

    const start = d;
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + this.defaultDuration);

    this.createFromSlot.emit({
      artistId,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      durationMinutes: this.defaultDuration,
    });
  }

  openDetails(ev: UiCalendarEvent) {
    this.action.emit({ type: 'open', event: ev });
  }

  edit(ev: UiCalendarEvent) {
    this.editEvent.emit(ev);
    this.action.emit({ type: 'edit', event: ev });
  }

  setStatus(ev: UiCalendarEvent, next: any) {
    switch (String(next)) {
      case 'confirmed': this.action.emit({ type: 'confirm', event: ev }); break;
      case 'paid': this.action.emit({ type: 'pay', event: ev }); break;
      case 'in_progress': this.action.emit({ type: 'start', event: ev }); break;
      case 'completed': this.action.emit({ type: 'complete', event: ev }); break;
      default: this.action.emit({ type: 'open', event: ev }); break;
    }
  }

  cancel(ev: UiCalendarEvent) {
    this.action.emit({ type: 'cancel', event: ev });
  }

  noShow(ev: UiCalendarEvent) {
    this.action.emit({ type: 'no_show', event: ev });
  }

  reschedule(ev: UiCalendarEvent) {
    this.action.emit({ type: 'reschedule', event: ev });
  }

  canConfirm(ev: UiCalendarEvent): boolean {
    const s = String((ev as any).status ?? 'draft');
    return ['draft', 'pending'].includes(s);
  }

  canPay(ev: UiCalendarEvent): boolean {
    const s = String((ev as any).status ?? 'draft');
    return ['confirmed'].includes(s);
  }

  canStart(ev: UiCalendarEvent): boolean {
    const s = String((ev as any).status ?? 'draft');
    return ['paid', 'confirmed'].includes(s);
  }

  canComplete(ev: UiCalendarEvent): boolean {
    const s = String((ev as any).status ?? 'draft');
    return ['in_progress'].includes(s);
  }

  // ===========================================================================
  // helpers
  // ===========================================================================
  formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }

  private toAgendaItem(e: UiCalendarEvent, nameMap: Map<string, string>): AgendaItem {
    const start = new Date(e.start);
    const hh = String(start.getHours()).padStart(2, '0');
    const mm = String(start.getMinutes()).padStart(2, '0');
    const range = `${this.formatTime(e.start)}–${this.formatTime(e.end)}`;

    const titleUi =
      (e as any).notes?.trim?.() ||
      (e as any).title?.trim?.() ||
      'Appuntamento';

    const artistName = nameMap.get(String((e as any).artistId ?? '')) ?? '';
    const subtitleUi =
      (e as any).clientName?.trim?.() ||
      (e as any).clientLabel?.trim?.() ||
      artistName;

    return { ...(e as any), hh, mm, range, titleUi, subtitleUi };
  }

  private toDayKeyLocal(iso: string): string {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
