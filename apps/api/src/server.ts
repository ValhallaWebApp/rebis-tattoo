import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { z } from "zod";
import crypto from "crypto";
import { pool } from "./db.js";
import { getAvailability } from "./scheduling.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  const r = await pool.query("SELECT 1 as ok");
  res.json({ ok: r.rows[0].ok === 1 });
});

app.get("/api/availability", async (req, res) => {
  const schema = z.object({
    staffId: z.string().min(1),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    duration: z.coerce.number().int().positive(),
    step: z.coerce.number().int().positive().default(15),
    buffer: z.coerce.number().int().nonnegative().default(0),
  });

  const p = schema.safeParse(req.query);
  if (!p.success) return res.status(400).json({ error: "BAD_REQUEST", details: p.error.flatten() });

  const data = await getAvailability({
    staffId: p.data.staffId,
    from: p.data.from,
    to: p.data.to,
    durationMinutes: p.data.duration,
    stepMinutes: p.data.step,
    bufferMinutes: p.data.buffer,
    now: new Date(),
  });

  res.json(data);
});

app.post("/api/holds", async (req, res) => {
  const schema = z.object({
    staffId: z.string().min(1),
    clientId: z.string().uuid(), // v1: obbligatorio
    start: z.string().datetime(),
    end: z.string().datetime(),
    ttlSeconds: z.number().int().positive().max(3600).default(600),
  });

  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "BAD_REQUEST", details: p.error.flatten() });

  const start = new Date(p.data.start);
  const end = new Date(p.data.end);
  if (!(end > start)) return res.status(400).json({ error: "INVALID_RANGE" });

  const token = "hold_" + crypto.randomUUID().replaceAll("-", "");
  const expiresAt = new Date(Date.now() + p.data.ttlSeconds * 1000);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // overlap check: bookings + sessions + holds non scaduti
    const overlap = await client.query(
      `
      SELECT 1
      WHERE EXISTS (
        SELECT 1 FROM bookings
        WHERE artist_user_id=$1 AND status IN ('held','confirmed')
          AND start_at < $3::timestamptz AND end_at > $2::timestamptz
      )
      OR EXISTS (
        SELECT 1 FROM sessions
        WHERE artist_user_id=$1 AND status IN ('planned','confirmed')
          AND start_at < $3::timestamptz AND end_at > $2::timestamptz
      )
      OR EXISTS (
        SELECT 1 FROM booking_holds
        WHERE artist_user_id=$1 AND expires_at > now()
          AND start_at < $3::timestamptz AND end_at > $2::timestamptz
      )
      `,
      [p.data.staffId, start.toISOString(), end.toISOString()]
    );

    if (overlap.rowCount && overlap.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "SLOT_NOT_AVAILABLE" });
    }

    await client.query(
      `INSERT INTO booking_holds (artist_user_id, client_user_id, start_at, end_at, expires_at, token)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [p.data.staffId, p.data.clientId, start.toISOString(), end.toISOString(), expiresAt.toISOString(), token]
    );

    await client.query("COMMIT");
    return res.status(201).json({ token, expiresAt: expiresAt.toISOString() });
  } catch (e: any) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "INTERNAL_ERROR", message: String(e?.message ?? e) });
  } finally {
    client.release();
  }
});

app.post("/api/bookings/confirm", async (req, res) => {
  const schema = z.object({
    holdToken: z.string().min(10),
    notes: z.string().max(2000).optional(),
    durationMinutes: z.number().int().positive().optional(),
    bufferMinutes: z.number().int().nonnegative().optional(),
  });

  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "BAD_REQUEST", details: p.error.flatten() });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const holdRes = await client.query(
      `SELECT id, artist_user_id, client_user_id, start_at, end_at, expires_at
       FROM booking_holds
       WHERE token = $1`,
      [p.data.holdToken]
    );

    if (holdRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "HOLD_NOT_FOUND" });
    }

    const hold = holdRes.rows[0];
    if (!hold.client_user_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "HOLD_MISSING_CLIENT" });
    }

    const expiresAt = new Date(hold.expires_at);
    if (expiresAt <= new Date()) {
      await client.query("ROLLBACK");
      return res.status(410).json({ error: "HOLD_EXPIRED" });
    }

    // re-check overlap (difesa doppia)
    const overlap = await client.query(
      `
      SELECT 1
      WHERE EXISTS (
        SELECT 1 FROM bookings
        WHERE artist_user_id=$1 AND status IN ('held','confirmed')
          AND start_at < $3::timestamptz AND end_at > $2::timestamptz
      )
      OR EXISTS (
        SELECT 1 FROM sessions
        WHERE artist_user_id=$1 AND status IN ('planned','confirmed')
          AND start_at < $3::timestamptz AND end_at > $2::timestamptz
      )
      `,
      [hold.artist_user_id, hold.start_at, hold.end_at]
    );

    if (overlap.rowCount && overlap.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "SLOT_NOT_AVAILABLE" });
    }

    const bookingRes = await client.query(
      `INSERT INTO bookings
        (artist_user_id, client_user_id, start_at, end_at, duration_minutes, buffer_minutes, status, notes)
       VALUES
        ($1, $2, $3, $4, EXTRACT(EPOCH FROM ($4::timestamptz - $3::timestamptz))/60, 0, 'confirmed', $5)
       RETURNING id, status`,
      [hold.artist_user_id, hold.client_user_id, hold.start_at, hold.end_at, p.data.notes ?? null]
    );

    await client.query(`DELETE FROM booking_holds WHERE id = $1`, [hold.id]);
    await client.query("COMMIT");

    return res.status(201).json({ bookingId: bookingRes.rows[0].id, status: bookingRes.rows[0].status });
  } catch (e: any) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "INTERNAL_ERROR", message: String(e?.message ?? e) });
  } finally {
    client.release();
  }
});

app.post("/api/holds/release", async (req, res) => {
  const schema = z.object({ holdToken: z.string().min(10) });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "BAD_REQUEST", details: p.error.flatten() });

  await pool.query(`DELETE FROM booking_holds WHERE token = $1`, [p.data.holdToken]);
  return res.status(204).send();
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`[rebis-api] listening on :${port}`);
});
