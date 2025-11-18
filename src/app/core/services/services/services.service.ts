import { Injectable } from '@angular/core';
import {
  Database,
  ref,
  push,
  set,
  update,
  remove,
  onValue,
  get
} from '@angular/fire/database';
import { Observable } from 'rxjs';

export interface Service {
  id: string;
  name: string;
  description: string;
  categoria: string;
  prezzo: number;
  durata: number;
  visibile: boolean;
  createdAt: number;
  updatedAt: number;
  creatoreId: string;
}

@Injectable({
  providedIn: 'root'
})
export class ServicesService {
  private readonly path = 'services';

  constructor(private db: Database) {}

  addService(service: Omit<Service, 'id'>): Promise<void> {
    const newRef = push(ref(this.db, this.path));
    return set(newRef, {
      ...service,
      id: newRef.key
    });
  }

  deleteService(id: string): Promise<void> {
    return remove(ref(this.db, `${this.path}/${id}`));
  }

  updateService(id: string, updatedData: Partial<Service>): Promise<void> {
    return update(ref(this.db, `${this.path}/${id}`), updatedData);
  }

  getServices(): Observable<Service[]> {
    return new Observable<Service[]>((observer) => {
      const servicesRef = ref(this.db, this.path);
      onValue(servicesRef, (snapshot) => {
        const data = snapshot.val();
        const services: Service[] = data
          ? Object.keys(data).map((key) => ({ id: key, ...data[key] }))
          : [];
        observer.next(services);
      });
    });
  }

  async getServiceById(id: string): Promise<Service | null> {
    const snapshot = await get(ref(this.db, `${this.path}/${id}`));
    return snapshot.exists() ? { id, ...snapshot.val() } : null;
  }
}
