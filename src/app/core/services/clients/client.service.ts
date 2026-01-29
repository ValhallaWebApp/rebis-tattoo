import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  CollectionReference,
  DocumentData,
  getDocs
} from '@angular/fire/firestore';
import { from, map, Observable } from 'rxjs';

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
  private readonly usersCol: CollectionReference<DocumentData>;

  constructor(private firestore: Firestore) {
    this.usersCol = collection(this.firestore, 'users');
  }

  /** ✅ Realtime: tutti gli utenti da Firestore */
  getClients(): Observable<Client[]> {
    return collectionData(this.usersCol, { idField: 'id' }) as Observable<Client[]>;
  }

  /** ✅ One-shot: lettura una volta sola (utile per search senza subscription lunga) */
  getAllUsersOnce(): Observable<Client[]> {
    return from(getDocs(this.usersCol)).pipe(
      map(snap => snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Client, 'id'>) })))
    );
  }
/** ✅ Lite list (one-shot) per autocomplete: TUTTI i clienti in memoria */
getClientsLiteOnce(): Observable<ClientLite[]> {
  return this.getAllUsersOnce().pipe(
    map(users =>
      users
        // filtro permissivo come searchClients (solo client/user ecc)
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

  /** ✅ Autocomplete: max 15 (filtra su nome/cognome/email/telefono) */
  searchClients(q: string): Observable<ClientLite[]> {
    const queryLower = (q ?? '').trim().toLowerCase();

    // NB: Firestore "contains" full-text non esiste nativo → fetch e filtro client-side
    return this.getAllUsersOnce().pipe(
      map(users =>
        users
          // se vuoi filtrare solo "client", usa una logica permissiva:
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
