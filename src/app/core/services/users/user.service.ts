import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export type UserRole =
  | 'admin'
  | 'staff'
  | 'client'
  | 'guest';

export interface User {
  id: string;
  name: string;
  email: string;
  sesso?:string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  urlAvatar?: string;
  dateOfBirth?: any;  // Firebase Timestamp o string
  createdAt: any;
  updatedAt?: any;
  role: UserRole;
}

@Injectable({
  providedIn: 'root'
})

export class UserService {

   constructor(private firestore: Firestore) {}

    getClients(): Observable<User[]> {
      const usersRef = collection(this.firestore, 'users');
      return collectionData(usersRef, { idField: 'id' }) as Observable<User[]>;
    }
}
