import { Injectable } from '@angular/core';
import { Database, get, onValue, push, ref, remove, set } from '@angular/fire/database';
import { Observable } from 'rxjs';

export type AuditStatus = 'success' | 'error';

export interface AuditLogEvent {
  action: string;
  resource: string;
  resourceId?: string;
  status?: AuditStatus;
  actorId?: string;
  actorRole?: string;
  targetUserId?: string;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface AuditLogRecord extends AuditLogEvent {
  id: string;
  at: string;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly path = 'auditLogs';

  constructor(private db: Database) {}

  async log(event: AuditLogEvent): Promise<void> {
    const now = new Date().toISOString();
    const node = push(ref(this.db, this.path));
    const id = node.key ?? `${Date.now()}`;

    const payload = this.stripUndef({
      id,
      at: now,
      action: event.action,
      resource: event.resource,
      resourceId: event.resourceId,
      status: event.status ?? 'success',
      actorId: event.actorId ?? 'system',
      actorRole: event.actorRole ?? 'system',
      targetUserId: event.targetUserId,
      message: event.message,
      meta: event.meta
    });

    try {
      await set(node, payload);
    } catch (err) {
      // Audit must never block business flows.
      console.error('[AuditLogService] log error', err);
    }
  }

  stream(limit = 500): Observable<AuditLogRecord[]> {
    return new Observable<AuditLogRecord[]>(observer => {
      const auditRef = ref(this.db, this.path);
      const unsubscribe = onValue(
        auditRef,
        snapshot => {
          if (!snapshot.exists()) {
            observer.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, Partial<AuditLogRecord>>;
          const rows: AuditLogRecord[] = Object.entries(raw)
            .map(([id, item]) => ({
              id,
              at: String(item.at ?? new Date(0).toISOString()),
              action: String(item.action ?? ''),
              resource: String(item.resource ?? ''),
              resourceId: item.resourceId ? String(item.resourceId) : undefined,
              status: (item.status as AuditStatus) ?? 'success',
              actorId: item.actorId ? String(item.actorId) : undefined,
              actorRole: item.actorRole ? String(item.actorRole) : undefined,
              targetUserId: item.targetUserId ? String(item.targetUserId) : undefined,
              message: item.message ? String(item.message) : undefined,
              meta: (item.meta ?? {}) as Record<string, unknown>
            }))
            .sort((a, b) => b.at.localeCompare(a.at))
            .slice(0, limit);

          observer.next(rows);
        },
        error => observer.error(error)
      );

      return () => unsubscribe();
    });
  }

  async pruneOlderThan(days = 90): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const snapshot = await get(ref(this.db, this.path));
    if (!snapshot.exists()) return 0;

    const raw = snapshot.val() as Record<string, Partial<AuditLogRecord>>;
    const toDelete = Object.entries(raw)
      .filter(([, item]) => String(item.at ?? '') < cutoff)
      .map(([id]) => id);

    await Promise.all(toDelete.map(id => remove(ref(this.db, `${this.path}/${id}`))));
    return toDelete.length;
  }

  private stripUndef<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) out[k] = v;
    }
    return out as Partial<T>;
  }
}
