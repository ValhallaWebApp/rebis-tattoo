import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiArtist, UiCalendarEvent } from '../../../models';
import { addDays, toDateKey } from '../../../utils';

@Component({
  selector: 'app-week-resource',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './week-resource.component.html',
  styleUrls: ['./week-resource.component.scss'],
})
export class WeekResourceComponent implements OnChanges {
  @Input({ required: true }) range!: { start: Date; end: Date };
  @Input({ required: true }) artists: UiArtist[] = [];
  @Input({ required: true }) events: UiCalendarEvent[] = [];

  @Output() openDay = new EventEmitter<{ artistId?: string; dateKey: string }>();

  private readonly rangeSig = signal<{ start: Date; end: Date }>({ start: new Date(), end: new Date() });
  private readonly artistsSig = signal<UiArtist[]>([]);
  private readonly eventsSig = signal<UiCalendarEvent[]>([]);

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
}
