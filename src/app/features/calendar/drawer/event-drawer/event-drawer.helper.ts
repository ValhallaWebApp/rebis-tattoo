import { UiArtist, UiCalendarEvent } from '../../models';

type IdCarrier = { id?: unknown; uid?: unknown; userId?: unknown };
type ClientLike = IdCarrier & { fullName?: string; email?: string; phone?: string };
type ProjectLike = IdCarrier & { title?: string; sessionIds?: string[]; clientId?: string; artistId?: string };
type BookingLike = IdCarrier & { start?: string; clientId?: string; title?: string };

export interface AvailableTimeOptionsInput {
  artistId: string;
  day: Date | null;
  durationMinutes: number;
  artists: UiArtist[];
  events: UiCalendarEvent[];
  editingEventId?: string | null;
  fallbackStart?: string;
  fallbackEnd?: string;
  fallbackStepMinutes?: number;
}

export class EventDrawerHelper {
  static buildTimes(from: string, to: string, stepMin: number): string[] {
    const [fh, fm] = from.split(':').map(Number);
    const [th, tm] = to.split(':').map(Number);
    const start = fh * 60 + fm;
    const end = th * 60 + tm;
    const out: string[] = [];

    for (let m = start; m <= end; m += stepMin) {
      out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }

    return out;
  }

  static toLocalDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  static toLocalDateTime(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  }

  static computeStartEnd(day: Date, timeHHmm: string, durationMin: number): { start: string; end: string } {
    const [hh, mm] = timeHHmm.split(':').map(Number);
    const startDate = new Date(day);
    startDate.setHours(hh, mm, 0, 0);

    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + durationMin);

    return {
      start: this.toLocalDateTime(startDate),
      end: this.toLocalDateTime(endDate)
    };
  }

  static computeAvailableTimeOptions(input: AvailableTimeOptionsInput): string[] {
    const artist = (input.artists ?? []).find(a => String(a.id) === String(input.artistId));
    const workdayStart = String((artist as any)?.workdayStart ?? input.fallbackStart ?? '08:00');
    const workdayEnd = String((artist as any)?.workdayEnd ?? input.fallbackEnd ?? '19:00');
    const step = Number((artist as any)?.stepMinutes ?? input.fallbackStepMinutes ?? 30) || 30;
    const timeOptions = this.buildTimes(workdayStart, workdayEnd, step);

    if (!input.artistId || !input.day || !input.durationMinutes) {
      return [...timeOptions];
    }

    const dayKey = this.toLocalDateKey(input.day);
    const busy = (input.events ?? [])
      .filter(e => e?.artistId === input.artistId)
      .filter(e => this.toLocalDateKey(new Date(e.start)) === dayKey)
      .filter(e => !input.editingEventId || e.id !== input.editingEventId);

    const nonBlocking = new Set(['cancelled', 'no_show']);
    const busyFiltered = busy.filter(e => !nonBlocking.has(String((e as any).status ?? '').toLowerCase()));

    const free: string[] = [];
    for (const t of timeOptions) {
      const slotStart = new Date(`${dayKey}T${t}:00`);
      const slotEnd = new Date(slotStart.getTime() + input.durationMinutes * 60000);
      const overlaps = busyFiltered.some(ev => {
        const evStart = new Date(ev.start);
        const evEnd = new Date(ev.end);
        return slotStart < evEnd && slotEnd > evStart;
      });
      if (!overlaps) free.push(t);
    }

    return free;
  }

  static matchClient(client: ClientLike, query: string): boolean {
    const name = (client.fullName ?? '').toLowerCase();
    const email = (client.email ?? '').toLowerCase();
    const phone = (client.phone ?? '').toLowerCase();
    return name.includes(query) || email.includes(query) || phone.includes(query);
  }

  static matchProject(project: ProjectLike, query: string): boolean {
    return (project.title ?? '').toLowerCase().includes(query);
  }

  static matchBooking(booking: BookingLike, query: string, clients: ClientLike[]): boolean {
    const clientName = (this.findByAnyId(clients ?? [], booking.clientId)?.fullName ?? '').toLowerCase();
    const time = booking.start ? this.formatTime(booking.start).toLowerCase() : '';
    const id = String(booking.id ?? '').toLowerCase();
    return clientName.includes(query) || time.includes(query) || id.includes(query);
  }

  static matchesAnyId(entity: IdCarrier | null | undefined, expected: string | undefined): boolean {
    const want = String(expected ?? '').trim();
    if (!want) return false;
    const candidates = [
      String(entity?.id ?? '').trim(),
      String(entity?.uid ?? '').trim(),
      String(entity?.userId ?? '').trim()
    ].filter(Boolean);
    return candidates.includes(want);
  }

  static findByAnyId<T extends IdCarrier>(list: T[], expected: string | undefined): T | undefined {
    const id = String(expected ?? '').trim();
    if (!id) return undefined;
    return (list ?? []).find(item => this.matchesAnyId(item, id));
  }

  static extractClientNameFromBookingTitle(title?: string): string {
    const raw = String(title ?? '').trim();
    if (!raw) return '';
    const cleaned = raw.replace(/\s*-\s*prenotazione$/i, '').trim();
    if (!cleaned) return '';
    return cleaned;
  }

  static getClientReadableLabel(clients: ClientLike[], clientId?: string, bookingTitle?: string): string {
    const client = this.findByAnyId(clients ?? [], clientId);
    if (client) {
      const name = String(client.fullName ?? '').trim();
      const email = String(client.email ?? '').trim();
      const phone = String(client.phone ?? '').trim();
      if (name && email) return `${name} - ${email}`;
      if (name) return name;
      if (email) return email;
      if (phone) return phone;
    }

    const fromTitle = this.extractClientNameFromBookingTitle(bookingTitle);
    if (fromTitle) return fromTitle;
    return 'Cliente';
  }

  static computeNextSessionNumber(projectId: string | undefined, projects: ProjectLike[], events: UiCalendarEvent[]): number | null {
    if (!projectId) return null;
    const project = (projects ?? []).find(p => String(p.id ?? '').trim() === String(projectId).trim());
    const countFromProject = project?.sessionIds?.length ?? 0;
    const countFromEvents = (events ?? [])
      .filter(event => event.type === 'session' && event.projectId === projectId)
      .length;
    return Math.max(countFromProject, countFromEvents) + 1;
  }

  static formatTime(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }
}
