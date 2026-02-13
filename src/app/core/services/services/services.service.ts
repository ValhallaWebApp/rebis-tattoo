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
  prezzoDaConcordare?: boolean;
  durataDaConcordare?: boolean;
  icon?: string;
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

  /**
   * CREA SERVIZIO
   */
  addService(
    service: Omit<Service, 'id' | 'createdAt' | 'updatedAt' | 'creatoreId'>
  ): Promise<void> {
    const now = Date.now();
    const newRef = push(ref(this.db, this.path));

    const payload: Service = {
      id: newRef.key!,
      createdAt: now,
      updatedAt: now,
      creatoreId: 'admin', // se usi auth → sostituisci con user.uid
      ...service,
      visibile: service.visibile ?? false
    };

    return set(newRef, payload);
  }

  /**
   * ELIMINA SERVIZIO
   */
  deleteService(id: string): Promise<void> {
    return remove(ref(this.db, `${this.path}/${id}`));
  }

  /**
   * AGGIORNA SERVIZIO (+ updatedAt automatico)
   */
  updateService(
    id: string,
    updatedData: Partial<Service>
  ): Promise<void> {
    return update(ref(this.db, `${this.path}/${id}`), {
      ...updatedData,
      updatedAt: Date.now()
    });
  }

  /**
   * GET TUTTI I SERVIZI IN REALTIME
   */
  getServices(): Observable<Service[]> {
    return new Observable<Service[]>((observer) => {
      const servicesRef = ref(this.db, this.path);

      onValue(servicesRef, (snapshot) => {
        const data = snapshot.val();

        const services: Service[] = data
          ? Object.keys(data).map((key) => ({
              id: key,
              ...data[key],
              visibile:
                data[key].visibile === true ||
                data[key].visibile === 'true'
            }))
          : [];

        // ORDINA per data creazione (più nuovo in alto)
        services.sort((a, b) => b.createdAt - a.createdAt);

        observer.next(services);
      });
    });
  }

  /**
   * GET SINGOLO SERVIZIO
   */
  async getServiceById(id: string): Promise<Service | null> {
    const snapshot = await get(ref(this.db, `${this.path}/${id}`));

    if (!snapshot.exists()) return null;

    const data = snapshot.val();

    return {
      id,
      ...data,
      visibile: data.visibile === true || data.visibile === 'true'
    } as Service;
  }
}
