import { Injectable } from '@angular/core';
import { AvailabilityByDateResult, AvailabilityByTimeResult, AvailabilitySlot, UiCalendarEvent } from './models';
import { addDays, endOfDay, overlaps, parseISO, setTimeOnDate, startOfDay, timeToMinutes, toDateKey, toISO, minutesToTime } from './utils';

export interface AvailabilityQueryBase {
  artistId: string;
  durationMinutes: number;
  events: UiCalendarEvent[]; // already filtered to artist
  workdayStart?: string; // "08:00"
  workdayEnd?: string;   // "20:00"
  stepMinutes?: number;  // 15/30
}

@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  getAvailableTimesByDate(
    q: AvailabilityQueryBase & { date: string } // YYYY-MM-DD
  ): AvailabilityByDateResult {
    const workdayStart = q.workdayStart ?? '08:00';
    const workdayEnd = q.workdayEnd ?? '20:00';
    const step = q.stepMinutes ?? 30;

    const day = new Date(`${q.date}T00:00:00`);
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);

    const artistEvents = q.events
      .filter(e => {
        const s = parseISO(e.start);
        return s >= dayStart && s <= dayEnd;
      })
      .map(e => ({ start: parseISO(e.start), end: parseISO(e.end) }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const startMin = timeToMinutes(workdayStart);
    const endMin = timeToMinutes(workdayEnd);

    const slots: AvailabilitySlot[] = [];
    for (let m = startMin; m + q.durationMinutes <= endMin; m += step) {
      const t = minutesToTime(m);
      const slotStart = setTimeOnDate(day, t);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + q.durationMinutes);

      const conflict = artistEvents.some(ev => overlaps(slotStart, slotEnd, ev.start, ev.end));
      if (!conflict) {
        slots.push({ time: t, startISO: toISO(slotStart), endISO: toISO(slotEnd) });
      }
    }

    return { date: q.date, slots };
  }

  getAvailableDatesByTime(
    q: AvailabilityQueryBase & { time: string; rangeDays?: number; fromDate?: Date }
  ): AvailabilityByTimeResult {
    const rangeDays = q.rangeDays ?? 30;
    const from = startOfDay(q.fromDate ?? new Date());
    const workdayStart = q.workdayStart ?? '08:00';
    const workdayEnd = q.workdayEnd ?? '20:00';

    // time must be within workday
    const tMin = timeToMinutes(q.time);
    if (tMin < timeToMinutes(workdayStart) || tMin >= timeToMinutes(workdayEnd)) {
      return { time: q.time, dates: [] };
    }

    const dates: { date: string; startISO: string; endISO: string }[] = [];

    for (let i = 0; i < rangeDays; i++) {
      const day = addDays(from, i);
      const dayKey = toDateKey(day);

      const slotStart = setTimeOnDate(day, q.time);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + q.durationMinutes);

      const dayEvents = q.events
        .filter(e => {
          const s = parseISO(e.start);
          return toDateKey(s) === dayKey;
        })
        .map(e => ({ start: parseISO(e.start), end: parseISO(e.end) }));

      const conflict = dayEvents.some(ev => overlaps(slotStart, slotEnd, ev.start, ev.end));
      if (!conflict) {
        dates.push({ date: dayKey, startISO: toISO(slotStart), endISO: toISO(slotEnd) });
      }
    }

    return { time: q.time, dates };
  }
}
