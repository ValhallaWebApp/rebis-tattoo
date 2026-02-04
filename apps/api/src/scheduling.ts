import { pool } from "./db.js";
import { DateTime } from "luxon";

export type Iso = string;

type RuleRow = {
  weekday: number; // 1..7 (Mon..Sun)
  start_time: string; // "09:00:00"
  end_time: string; // "13:00:00"
  timezone: string;
};

type BusyRow = {
  start_at: string;
  end_at: string;
};

export function toMinutes(t: string) {
  // "HH:MM:SS" or "HH:MM"
  const parts = t.split(":").map(Number);
  const hh = parts[0] ?? 0;
  const mm = parts[1] ?? 0;
  return hh * 60 + mm;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function iso(d: Date): Iso {
  return d.toISOString();
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

export async function getAvailability(params: {
  staffId: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD (end esclusivo)
  durationMinutes: number;
  stepMinutes: number;
  bufferMinutes?: number;
  now: Date;
}) {
  const {
    staffId,
    from,
    to,
    durationMinutes,
    stepMinutes,
    bufferMinutes = 0,
    now,
  } = params;

  // 1) regole settimanali
  const rulesRes = await pool.query<RuleRow>(
    `SELECT weekday, start_time, end_time, timezone
     FROM availability_rules
     WHERE staff_user_id = $1`,
    [staffId]
  );
  const rules = rulesRes.rows;

  // 2) busy intervals: bookings + sessions + holds (non scaduti)
  const busy: { start: Date; end: Date }[] = [];

  const bookingsRes = await pool.query<BusyRow>(
    `SELECT start_at, end_at FROM bookings
     WHERE artist_user_id = $1
       AND status IN ('held','confirmed')
       AND start_at < $3::timestamptz
       AND end_at   > $2::timestamptz`,
    [staffId, from, to]
  );
  bookingsRes.rows.forEach((r) => {
    const s = new Date(r.start_at);
    const e = new Date(r.end_at);
    busy.push({
      start: addMinutes(s, -bufferMinutes),
      end: addMinutes(e, bufferMinutes),
    });
  });

  const sessionsRes = await pool.query<BusyRow>(
    `SELECT start_at, end_at FROM sessions
     WHERE artist_user_id = $1
       AND status IN ('planned','confirmed')
       AND start_at < $3::timestamptz
       AND end_at   > $2::timestamptz`,
    [staffId, from, to]
  );
  sessionsRes.rows.forEach((r) => {
    const s = new Date(r.start_at);
    const e = new Date(r.end_at);
    busy.push({
      start: addMinutes(s, -bufferMinutes),
      end: addMinutes(e, bufferMinutes),
    });
  });

  const holdsRes = await pool.query<BusyRow>(
    `SELECT start_at, end_at FROM booking_holds
     WHERE artist_user_id = $1
       AND expires_at > now()
       AND start_at < $3::timestamptz
       AND end_at   > $2::timestamptz`,
    [staffId, from, to]
  );
  holdsRes.rows.forEach((r) => {
    const s = new Date(r.start_at);
    const e = new Date(r.end_at);
    busy.push({
      start: addMinutes(s, -bufferMinutes),
      end: addMinutes(e, bufferMinutes),
    });
  });

  // 3) generazione giorni e slot in Europe/Rome (DST safe)
  const zone = "Europe/Rome";
  const fromD = DateTime.fromISO(from, { zone }).startOf("day");
  const toD = DateTime.fromISO(to, { zone }).startOf("day"); // end esclusivo

  const days: { date: string; slots: { start: Iso; end: Iso }[] }[] = [];

  for (let d = fromD; d < toD; d = d.plus({ days: 1 })) {
    const weekday = d.weekday; // 1..7
    const dayRules = rules.filter((r) => r.weekday === weekday);

    const slots: { start: Iso; end: Iso }[] = [];

    for (const r of dayRules) {
      const startMin = toMinutes(r.start_time);
      const endMin = toMinutes(r.end_time);

      for (let t = startMin; t + durationMinutes <= endMin; t += stepMinutes) {
        const s = d.plus({ minutes: t });
        const e = s.plus({ minutes: durationMinutes });

        // no past (now nella stessa zona)
        const nowZ = DateTime.fromJSDate(now, { zone });
        if (s <= nowZ) continue;

        // overlap check (busy è Date JS)
        const sDate = s.toJSDate();
        const eDate = e.toJSDate();

        const isBusy = busy.some((b) => overlaps(sDate, eDate, b.start, b.end));
        if (!isBusy) {
          // ISO con offset Europe/Rome (+01:00/+02:00)
          slots.push({ start: s.toISO()!, end: e.toISO()! });
        }
      }
    }

    days.push({ date: d.toISODate()!, slots });
  }

  return {
    timezone: "Europe/Rome",
    staffId,
    durationMinutes,
    stepMinutes,
    days,
  };
}
