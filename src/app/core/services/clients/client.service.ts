import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export type ClientRole =
  | 'admin'
  | 'client'
  | 'guest';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  avatar?: string;
  dateOfBirth?: any;  // Firebase Timestamp o string
  createdAt?: any;
  updatedAt?: any;
  role?: 'admin' | 'user' | 'guest' | string;
  totalSpent?: number;
  ongoing?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  constructor(private firestore: Firestore) {}

  getClients(): Observable<Client[]> {
    const usersRef = collection(this.firestore, 'users');
    return collectionData(usersRef, { idField: 'id' }) as Observable<Client[]>;
  }
}
