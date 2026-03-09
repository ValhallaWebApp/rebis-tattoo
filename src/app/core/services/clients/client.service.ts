import { Injectable } from '@angular/core';
import { map, Observable, take } from 'rxjs';
import { User, UserService } from '../users/user.service';

export type ClientRole = 'admin' | 'client' | 'guest';

export interface Client {
  id?: string;

  name?: string;
  surname?: string;
  fullName?: string;

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

export function getClientDisplayName(client?: Partial<Client> | null, fallback = 'Utente'): string {
  const fullName = String(client?.fullName ?? '').trim();
  if (fullName) return fullName;

  const composed = `${String(client?.name ?? '').trim()} ${String(client?.surname ?? '').trim()}`.trim();
  if (composed) return composed;

  const email = String(client?.email ?? '').trim();
  if (email) return email;

  const phone = String(client?.phone ?? '').trim();
  if (phone) return phone;

  return fallback;
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  constructor(private readonly users: UserService) {}

  // Realtime clients from canonical users stream
  getClients(): Observable<Client[]> {
    return this.users.getAllUsers().pipe(
      map((list) =>
        (list ?? [])
          .filter((u) => this.isClientRole(u))
          .filter((u) => this.isSelectable(u))
          .map((u) => this.toClient(u))
      )
    );
  }

  // One-shot from canonical users stream
  getAllUsersOnce(): Observable<Client[]> {
    return this.getClients().pipe(take(1));
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
    return getClientDisplayName(u, String(u.id ?? '').trim() || 'Utente');
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

  private toClient(u: User): Client {
    const maybeSurname = String((u as any)?.surname ?? '').trim() || undefined;
    const fullName = getClientDisplayName(
      {
        name: String(u.name ?? '').trim() || undefined,
        surname: maybeSurname,
        email: String(u.email ?? '').trim() || undefined,
        phone: String(u.phone ?? '').trim() || undefined
      },
      String(u.id ?? '').trim() || 'Utente'
    );

    return {
      id: String(u.id ?? '').trim() || undefined,
      name: String(u.name ?? '').trim() || undefined,
      surname: maybeSurname,
      fullName,
      email: String(u.email ?? '').trim() || undefined,
      phone: String(u.phone ?? '').trim() || undefined,
      avatar: String(u.urlAvatar ?? '').trim() || undefined,
      createdAt: u.createdAt ?? undefined,
      updatedAt: u.updatedAt ?? undefined,
      role: String(u.role ?? '').trim() || undefined,
      isActive: u.isActive,
      isVisible: u.isVisible,
      deletedAt: u.deletedAt ?? null
    };
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
