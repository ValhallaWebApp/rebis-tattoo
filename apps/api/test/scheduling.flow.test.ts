import { describe, it, expect } from "vitest";
import { pool } from "../src/db.js";

const staffId = "11111111-1111-1111-1111-111111111111";
const clientId = "22222222-2222-2222-2222-222222222222";

describe("FASE 2.1 - scheduling db flow", () => {
  it("db is reachable", async () => {
    const r = await pool.query("SELECT 1 as ok");
    expect(r.rows[0].ok).toBe(1);
  });

  it("confirmed booking exists and blocks overlap", async () => {
    // booking confermato creato prima: 09:00-09:45Z
    const start = "2026-02-02T09:00:00.000Z";
    const end   = "2026-02-02T09:45:00.000Z";

    const overlap = await pool.query(
      `SELECT 1 FROM bookings
       WHERE artist_user_id=$1 AND status IN ('held','confirmed')
         AND start_at < $3::timestamptz
         AND end_at   > $2::timestamptz
       LIMIT 1`,
      [staffId, start, end]
    );

    expect(overlap.rowCount).toBe(1);
  });

  it("can create a temporary hold on a free slot and delete it", async () => {
    const token = "test_hold_" + Date.now();
    const start = "2026-02-02T11:00:00.000Z";
    const end   = "2026-02-02T11:45:00.000Z";

    await pool.query(
      `INSERT INTO booking_holds
       (artist_user_id, client_user_id, start_at, end_at, expires_at, token)
       VALUES ($1,$2,$3,$4, now() + interval '10 minutes', $5)`,
      [staffId, clientId, start, end, token]
    );

    const check = await pool.query(
      `SELECT token FROM booking_holds WHERE token=$1`,
      [token]
    );
    expect(check.rowCount).toBe(1);

    await pool.query(`DELETE FROM booking_holds WHERE token=$1`, [token]);
  });

  it("cleanup removes expired holds", async () => {
    const token = "expired_hold_" + Date.now();
    const start = "2026-02-02T12:00:00.000Z";
    const end   = "2026-02-02T12:45:00.000Z";

    await pool.query(
      `INSERT INTO booking_holds
       (artist_user_id, client_user_id, start_at, end_at, expires_at, token)
       VALUES ($1,$2,$3,$4, now() - interval '1 minute', $5)`,
      [staffId, clientId, start, end, token]
    );

    await pool.query(`DELETE FROM booking_holds WHERE expires_at <= now()`);

    const check = await pool.query(
      `SELECT token FROM booking_holds WHERE token=$1`,
      [token]
    );
    expect(check.rowCount).toBe(0);
  });
});
