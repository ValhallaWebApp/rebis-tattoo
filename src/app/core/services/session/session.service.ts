import { Injectable } from '@angular/core';
import {
  Database,
  ref,
  push,
  set,
  update,
  remove,
  get,
  query,
  orderByChild,
  equalTo,
  onValue
} from '@angular/fire/database';
import { Observable, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface Session {
  id?: string;
  idArtist: string;
  idClient?: string;
  start: string;
  end: string;
  projectId?: string;
  sessionNumber?: number;
  notesByAdmin?: string;
  price?: number;
  painLevel?: number;
  healingNotes?: string;
  photoUrlList?: string[];
  status: 'planned' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  paidAmount?: number;

}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly path = 'sessions';

  constructor(
    private db: Database,
    private snackbar: MatSnackBar
  ) {}
getAll(): Observable<Session[]> {
  const sessionsRef = ref(this.db, this.path);
  return new Observable(obs =>
    onValue(sessionsRef, snap => {
      const list = snap.exists()
        ? Object.values<Session>(snap.val())
        : [];
      obs.next(list);
    }, {
      onlyOnce: true
    })
  );
}

  private showMessage(message: string, isError: boolean = false) {
    this.snackbar.open(message, 'Chiudi', {
      duration: 3000,
      panelClass: isError ? ['mat-warn'] : ['mat-primary']
    });
  }

  async create(session: Session): Promise<void> {
    try {
      const node = push(ref(this.db, this.path));
      const now = new Date().toISOString();
      await set(node, {
        ...session,
        id: node.key,
        createdAt: now,
        updatedAt: now,
        status: session.status ?? 'planned'
      });
      this.showMessage('Seduta creata con successo');
    } catch (error) {
      console.error('Errore creazione seduta:', error);
      this.showMessage('Errore durante la creazione della seduta', true);
      throw error;
    }
  }

  async update(id: string, changes: Partial<Session>): Promise<void> {
    try {
      await update(ref(this.db, `${this.path}/${id}`), {
        ...changes,
        updatedAt: new Date().toISOString()
      });
      this.showMessage('Seduta aggiornata con successo');
    } catch (error) {
      console.error('Errore aggiornamento seduta:', error);
      this.showMessage('Errore durante l\'aggiornamento della seduta', true);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await remove(ref(this.db, `${this.path}/${id}`));
      this.showMessage('Seduta eliminata con successo');
    } catch (error) {
      console.error('Errore eliminazione seduta:', error);
      this.showMessage('Errore durante l\'eliminazione della seduta', true);
      throw error;
    }
  }

  getSessionsByArtist(artistId: string): Observable<Session[]> {
    const q = query(
      ref(this.db, this.path),
      orderByChild('idArtist'),
      equalTo(artistId)
    );
    return new Observable(obs =>
      onValue(q, snap => {
        const list = snap.val()
          ? Object.values<Session>(snap.val())
          : [];
        obs.next(list);
      })
    );
  }

  getSessionsByProject(projectId: string): Observable<Session[]> {
    const q = query(
      ref(this.db, this.path),
      orderByChild('projectId'),
      equalTo(projectId)
    );
    return new Observable(obs =>
      onValue(q, snap => {
        const list = snap.val()
          ? Object.values<Session>(snap.val())
          : [];
        obs.next(list);
      })
    );
  }

  async getSessionById(id: string): Promise<Session | null> {
    const snap = await get(ref(this.db, `${this.path}/${id}`));
    return snap.exists() ? (snap.val() as Session) : null;
  }
}
