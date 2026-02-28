import { Injectable } from '@angular/core';
import { Database, get, onValue, ref } from '@angular/fire/database';
import { map, Observable } from 'rxjs';

export type ClientRole = 'admin' | 'client' | 'guest';

export interface Client {
  id?: string;

  name?: string;
  surname?: string;

  email?: string;
  phone?: string;

  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  avatar?: string;

  dateOfBirth?: any;
  createdAt?: any;
  updatedAt?: any;

  role?: ClientRole | 'user' | string;
  totalSpent?: number;
  ongoing?: boolean;
  isActive?: boolean;
  isVisible?: boolean;
  deletedAt?: string | null;
}

export interface ClientLite {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  constructor(private db: Database) {}

  // Realtime users from RTDB
  getClients(): Observable<Client[]> {
    return new Observable<Client[]>((observer) => {
      const usersRef = ref(this.db, 'users');
      const unsub = onValue(
        usersRef,
        (snap) => {
          if (!snap.exists()) {
            observer.next([]);
            return;
          }
          const raw = snap.val() as Record<string, any>;
          const list = Object.entries(raw).map(([id, value]) => ({ id, ...(value as any) } as Client));
          observer.next(list);
        },
        (err) => observer.error(err)
      );
      return () => unsub();
    });
  }

  // One-shot read from RTDB
  getAllUsersOnce(): Observable<Client[]> {
    return new Observable<Client[]>((observer) => {
      get(ref(this.db, 'users'))
        .then((snap) => {
          if (!snap.exists()) {
            observer.next([]);
            observer.complete();
            return;
          }
          const raw = snap.val() as Record<string, any>;
          const list = Object.entries(raw).map(([id, value]) => ({ id, ...(value as any) } as Client));
          observer.next(list);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  getClientsLiteOnce(): Observable<ClientLite[]> {
    return this.getAllUsersOnce().pipe(
      map(users => this.toClientsLite(users))
    );
  }

  searchClients(q: string): Observable<ClientLite[]> {
    const queryLower = (q ?? '').trim().toLowerCase();

    return this.getClientsLiteOnce().pipe(
      map(users =>
        (users ?? [])
          .filter(c =>
            !queryLower ||
            c.fullName.toLowerCase().includes(queryLower) ||
            (c.email ?? '').toLowerCase().includes(queryLower) ||
            (c.phone ?? '').toLowerCase().includes(queryLower)
          )
          .slice(0, 15)
      )
    );
  }

  private buildFullName(u: Client): string {
    const full = `${u.name ?? ''} ${u.surname ?? ''}`.trim();
    return full || (u.email ?? '') || (u.phone ?? '') || u.id || 'Utente';
  }

  private toClientsLite(users: Client[]): ClientLite[] {
    const base = (users ?? [])
      .filter(u => this.isClientRole(u))
      .filter(u => this.isSelectable(u))
      .map(u => ({
        id: String(u.id ?? '').trim(),
        fullName: this.buildFullName(u),
        email: String(u.email ?? '').trim() || undefined,
        phone: String(u.phone ?? '').trim() || undefined,
      }))
      .filter(x => !!x.id);

    return this.dedupeByContact(base);
  }

  private isClientRole(u: Client): boolean {
    const r = String(u.role ?? '').toLowerCase().trim();
    return r === '' || r === 'client' || r === 'user' || r === 'cliente';
  }

  private isSelectable(u: Client): boolean {
    if (u.deletedAt != null && String(u.deletedAt).trim() !== '') return false;
    if (u.isActive === false) return false;
    if (u.isVisible === false) return false;
    return true;
  }

  private dedupeByContact(list: ClientLite[]): ClientLite[] {
    const out = new Map<string, ClientLite>();

    for (const c of list) {
      const emailKey = String(c.email ?? '').trim().toLowerCase();
      const phoneKey = String(c.phone ?? '').replace(/\D+/g, '');
      const key = emailKey ? `e:${emailKey}` : (phoneKey ? `p:${phoneKey}` : `id:${c.id}`);

      const prev = out.get(key);
      if (!prev) {
        out.set(key, c);
        continue;
      }

      const prevScore = this.clientLiteScore(prev);
      const nextScore = this.clientLiteScore(c);
      if (nextScore >= prevScore) out.set(key, c);
    }

    return Array.from(out.values()).sort((a, b) => a.fullName.localeCompare(b.fullName, 'it'));
  }

  private clientLiteScore(c: ClientLite): number {
    let score = 0;
    if (String(c.fullName ?? '').trim().length > 0) score += 2;
    if (String(c.email ?? '').trim().length > 0) score += 2;
    if (String(c.phone ?? '').trim().length > 0) score += 1;
    return score;
  }
}
