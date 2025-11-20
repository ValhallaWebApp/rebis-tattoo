import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData } from '@angular/fire/firestore';
import { map, Observable, of } from 'rxjs';
import { AuthService } from '../auth/authservice';

export type UserRole = 'admin' | 'staff' | 'client' | 'guest';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  createdAt: any;
  updatedAt?: any;
  urlAvatar:any
  // altri campi...
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);

  constructor() {}

  getCurrentUserId(): string | null {
    return this.auth.userSig()?.uid || null;
  }

  getCurrentUserRole(): UserRole | any {
    return this.auth.userSig()?.role || 'guest';
  }

  getClients(): Observable<User[]> {
    const uid = this.getCurrentUserId();
    const role = this.getCurrentUserRole();

    if (role === 'admin') {
      const usersRef = collection(this.firestore, 'users');
      return collectionData(usersRef, { idField: 'id' }) as Observable<User[]>;
    } else if (uid) {
      const userRef = doc(this.firestore, 'users', uid);
      return docData(userRef, { idField: 'id' }).pipe(map(user => [user as User]));
    } else {
      return of([]); // non autenticato
    }
  }
}
