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
      map(users =>
        users
          .filter(u => {
            const r = String(u.role ?? '').toLowerCase();
            return r === '' || r === 'client' || r === 'user' || r === 'cliente';
          })
          .map(u => ({
            id: String(u.id ?? ''),
            fullName: this.buildFullName(u),
            email: u.email,
            phone: u.phone,
          }))
          .filter(x => !!x.id)
      )
    );
  }

  searchClients(q: string): Observable<ClientLite[]> {
    const queryLower = (q ?? '').trim().toLowerCase();

    return this.getAllUsersOnce().pipe(
      map(users =>
        users
          .filter(u => {
            const r = String(u.role ?? '').toLowerCase();
            return r === '' || r === 'client' || r === 'user' || r === 'cliente';
          })
          .map(u => ({
            id: String(u.id ?? ''),
            fullName: this.buildFullName(u),
            email: u.email,
            phone: u.phone,
          }))
          .filter(c => !!c.id)
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
}
