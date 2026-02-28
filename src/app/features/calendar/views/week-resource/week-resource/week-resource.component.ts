import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiArtist, UiCalendarEvent } from '../../../models';
import { addDays, toDateKey } from '../../../utils';
import { MaterialModule } from '../../../../../core/modules/material.module';
import type { AdminActionPayload } from '../../day-view/day-view.component';

interface WeekEventListItem {
  id: string;
  dayKey: string;
  dateLabel: string;
  startLabel: string;
  endLabel: string;
  range: string;
  type: 'booking' | 'session';
  typeLabel: string;
  status: string;
  title: string;
  subtitle: string;
  artistId: string;
  artistName: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  event: UiCalendarEvent;
}

@Component({
  selector: 'app-week-resource',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './week-resource.component.html',
  styleUrls: ['./week-resource.component.scss'],
})
export class WeekResourceComponent implements OnChanges {
  @Input({ required: true }) range!: { start: Date; end: Date };
  @Input({ required: true }) artists: UiArtist[] = [];
  @Input({ required: true }) events: UiCalendarEvent[] = [];
  @Input() clients: Array<{ id: string; fullName?: string; email?: string; phone?: string }> = [];
  private viewLayout: 'cards' | 'list' = 'cards';

  @Input()
  set weekLayout(v: unknown) {
    this.viewLayout = v === 'list' ? 'list' : 'cards';
  }
  get weekLayout(): 'cards' | 'list' {
    return this.viewLayout;
  }

  // backward-compatible alias
  @Input()
  set layout(v: unknown) {
    this.weekLayout = v;
  }

  @Output() openDay = new EventEmitter<{ artistId?: string; dateKey: string }>();
  @Output() editEvent = new EventEmitter<UiCalendarEvent>();
  @Output() action = new EventEmitter<AdminActionPayload>();

  private readonly rangeSig = signal<{ start: Date; end: Date }>({ start: new Date(), end: new Date() });
  private readonly artistsSig = signal<UiArtist[]>([]);
  private readonly eventsSig = signal<UiCalendarEvent[]>([]);
  private readonly clientsSig = signal<Array<{ id: string; fullName?: string; email?: string; phone?: string }>>([]);

  readonly filterFrom = signal('');
  readonly filterTo = signal('');
  readonly filterQuery = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['range'] && changes['range'].currentValue) {
      this.rangeSig.set(changes['range'].currentValue);
    }
    if (changes['artists']) {
      this.artistsSig.set(changes['artists'].currentValue ?? []);
    }
    if (changes['events']) {
      this.eventsSig.set(changes['events'].currentValue ?? []);
    }
    if (changes['clients']) {
      this.clientsSig.set(changes['clients'].currentValue ?? []);
    }
  }

  readonly days = computed(() => {
    const out: { key: string; label: string; date: Date }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(this.rangeSig().start, i);
      out.push({
        key: toDateKey(d),
        date: d,
        label: d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit' }),
      });
    }
    return out;
  });

  readonly dayArtistCountMap = computed(() => {
    const dayMap = new Map<string, Map<string, number>>();
    const dayKeys = new Set(this.days().map(d => d.key));
    const artistIds = new Set(this.artistsSig().map(a => String(a.id)));

    for (const key of dayKeys) {
      dayMap.set(key, new Map<string, number>());
    }

    for (const ev of this.eventsSig()) {
      const dayKey = toDateKey(new Date(ev.start));
      const artistId = String(ev.artistId ?? '');
      if (!dayKeys.has(dayKey) || !artistIds.has(artistId)) continue;

      const perDay = dayMap.get(dayKey);
      if (!perDay) continue;
      perDay.set(artistId, (perDay.get(artistId) ?? 0) + 1);
    }

    return dayMap;
  });

  readonly daySummaries = computed(() => {
    const countMap = this.dayArtistCountMap();
    const artists = this.artistsSig();

    return this.days().map(day => {
      const perDay = countMap.get(day.key) ?? new Map<string, number>();
      const artistCounts = artists
        .map(artist => ({
          artistId: String(artist.id),
          name: artist.name,
          count: perDay.get(String(artist.id)) ?? 0,
        }))
        .filter(entry => entry.count > 0)
        .sort((a, b) => b.count - a.count);

      const total = artistCounts.reduce((sum, entry) => sum + entry.count, 0);
      return {
        key: day.key,
        label: day.label,
        total,
        artistCounts,
        visibleArtistCounts: artistCounts.slice(0, 5),
        hiddenArtistsCount: Math.max(0, artistCounts.length - 5),
      };
    });
  });

  readonly weekEventItems = computed<WeekEventListItem[]>(() => {
    const dayKeys = new Set(this.days().map(d => d.key));
    const artistMap = new Map<string, string>(
      (this.artistsSig() ?? []).map(a => [String(a.id), String(a.name ?? '').trim()])
    );
    const clientsMap = new Map(
      (this.clientsSig() ?? []).map(c => [
        String(c.id ?? '').trim(),
        {
          fullName: String(c.fullName ?? '').trim(),
          email: String(c.email ?? '').trim(),
          phone: String(c.phone ?? '').trim(),
        },
      ])
    );

    return (this.eventsSig() ?? [])
      .map(ev => {
        const startDate = new Date(ev.start);
        const endDate = new Date(ev.end);
        const dayKey = toDateKey(startDate);
        if (!dayKeys.has(dayKey)) return null;

        const artistId = String(ev.artistId ?? '');
        const artistName = artistMap.get(artistId) ?? 'Artista';
        const startLabel = this.formatTime(ev.start);
        const endLabel = this.formatTime(ev.end);
        const type = ev.type === 'session' ? 'session' : 'booking';
        const clientId = String(ev.clientId ?? '').trim();
        const clientRow = clientId ? clientsMap.get(clientId) : undefined;
        const clientName =
          String((ev as any).clientName ?? '').trim() ||
          String((ev as any).clientLabel ?? '').trim() ||
          String(clientRow?.fullName ?? '').trim();
        const clientEmail =
          String((ev as any).clientEmail ?? '').trim() ||
          String(clientRow?.email ?? '').trim();
        const clientPhone =
          String((ev as any).clientPhone ?? '').trim() ||
          String(clientRow?.phone ?? '').trim();
        const title =
          String((ev as any).notes ?? '').trim() ||
          String((ev as any).title ?? '').trim() ||
          (type === 'session' ? 'Seduta' : 'Consulenza');

        const item: WeekEventListItem = {
          id: String(ev.id ?? ''),
          dayKey,
          dateLabel: this.formatDate(startDate),
          startLabel,
          endLabel,
          range: `${startLabel}-${endLabel}`,
          type,
          typeLabel: type === 'session' ? 'Seduta' : 'Consulenza',
          status: String((ev as any).status ?? '').trim() || '-',
          title,
          subtitle: clientName || artistName,
          artistId,
          artistName,
          clientId,
          clientName,
          clientEmail,
          clientPhone,
          event: ev,
        };
        return item;
      })
      .filter((item): item is WeekEventListItem => !!item)
      .sort((a, b) => {
        const aDate = new Date(`${a.dayKey}T${a.startLabel}:00`).getTime();
        const bDate = new Date(`${b.dayKey}T${b.startLabel}:00`).getTime();
        return aDate - bDate;
      });
  });

  readonly filteredWeekEventItems = computed<WeekEventListItem[]>(() => {
    const list = this.weekEventItems();
    const fromRaw = String(this.filterFrom() ?? '').trim();
    const toRaw = String(this.filterTo() ?? '').trim();
    const q = String(this.filterQuery() ?? '').trim().toLowerCase();

    let from = fromRaw;
    let to = toRaw;
    if (from && to && from > to) {
      const tmp = from;
      from = to;
      to = tmp;
    }

    return list.filter(item => {
      if (from && item.dayKey < from) return false;
      if (to && item.dayKey > to) return false;
      if (!q) return true;

      const hay = [
        item.clientName,
        item.clientEmail,
        item.clientPhone,
      ].join(' ').toLowerCase();

      return hay.includes(q);
    });
  });

  readonly legendEntries = computed(() => {
    const dayMap = this.dayArtistCountMap();
    const totalsByArtist = new Map<string, number>();

    for (const perDay of dayMap.values()) {
      for (const [artistId, count] of perDay.entries()) {
        totalsByArtist.set(artistId, (totalsByArtist.get(artistId) ?? 0) + count);
      }
    }

    return this.artistsSig()
      .map(artist => {
        const artistId = String(artist.id);
        const total = totalsByArtist.get(artistId) ?? 0;
        return {
          artistId,
          name: artist.name,
          total,
          color: this.artistColor(artistId),
        };
      })
      .filter(entry => entry.total > 0)
      .sort((a, b) => b.total - a.total);
  });

  intensityClass(count: number): string {
    if (count === 0) return 'c0';
    if (count === 1) return 'c1';
    if (count <= 3) return 'c2';
    return 'c3';
  }

  artistColor(artistId: string): string {
    const artist = this.artistsSig().find(a => String(a.id) === String(artistId));
    const explicit = String(artist?.color ?? '').trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(explicit)) return explicit;

    const palette = [
      '#f59e0b',
      '#06b6d4',
      '#22c55e',
      '#a78bfa',
      '#ef4444',
      '#f97316',
      '#14b8a6',
      '#3b82f6',
      '#84cc16',
      '#f43f5e',
    ];

    let hash = 0;
    for (let i = 0; i < artistId.length; i++) {
      hash = ((hash << 5) - hash) + artistId.charCodeAt(i);
      hash |= 0;
    }

    const idx = Math.abs(hash) % palette.length;
    return palette[idx];
  }

  private formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }

  private formatDate(d: Date): string {
    return d.toLocaleDateString('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
  }

  setFilterFrom(v: string): void {
    this.filterFrom.set(this.normalizeDateKey(v));
  }

  setFilterTo(v: string): void {
    this.filterTo.set(this.normalizeDateKey(v));
  }

  setFilterQuery(v: string): void {
    this.filterQuery.set(v ?? '');
  }

  resetFilters(): void {
    this.filterFrom.set('');
    this.filterTo.set('');
    this.filterQuery.set('');
  }

  openEvent(ev: UiCalendarEvent): void {
    this.editEvent.emit(ev);
  }

  edit(ev: UiCalendarEvent): void {
    this.editEvent.emit(ev);
    this.action.emit({ type: 'edit', event: ev });
  }

  emitAction(type: AdminActionPayload['type'], ev: UiCalendarEvent): void {
    this.action.emit({ type, event: ev });
  }

  dateFilterToDate(value: string): Date | null {
    const normalized = this.normalizeDateKey(value);
    if (!normalized) return null;
    const [y, m, d] = normalized.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  onFilterFromDateChange(value: Date | null): void {
    this.filterFrom.set(value ? toDateKey(value) : '');
  }

  onFilterToDateChange(value: Date | null): void {
    this.filterTo.set(value ? toDateKey(value) : '');
  }

  private normalizeDateKey(value: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    const direct = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (direct) return raw;

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return toDateKey(parsed);
  }
}
