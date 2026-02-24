import { Injectable } from '@angular/core';
import { Database, get, onValue, push, ref, remove, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/authservice';
import { ConfirmActionService } from '../ui/confirm-action.service';
import { UiFeedbackService } from '../ui/ui-feedback.service';

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

  constructor(
    private db: Database,
    private auth: AuthService,
    private ui: UiFeedbackService,
    private confirmAction: ConfirmActionService
  ) {}

  private assertAdminAction(): void {
    if (this.auth.userSig()?.role !== 'admin') {
      throw new Error('Azione consentita solo ad admin');
    }
  }

  private isPermissionDeniedError(err: unknown): boolean {
    const code = String((err as any)?.code ?? '').toLowerCase();
    const msg = String((err as any)?.message ?? '').toLowerCase();
    return code.includes('permission-denied') || msg.includes('permission_denied') || msg.includes('permission denied');
  }

  private normalizeServiceInput(
    service: Omit<Service, 'id' | 'createdAt' | 'updatedAt' | 'creatoreId'>
  ): Omit<Service, 'id' | 'createdAt' | 'updatedAt' | 'creatoreId'> {
    return {
      ...service,
      name: String(service.name ?? '').trim(),
      description: String(service.description ?? '').trim(),
      categoria: String(service.categoria ?? 'altro').trim().toLowerCase(),
      prezzo: Number(service.prezzo ?? 0),
      durata: Number(service.durata ?? 0),
      visibile: service.visibile === true,
      prezzoDaConcordare: service.prezzoDaConcordare === true,
      durataDaConcordare: service.durataDaConcordare === true,
      icon: String(service.icon ?? '').trim()
    };
  }

  addService(service: Omit<Service, 'id' | 'createdAt' | 'updatedAt' | 'creatoreId'>): Promise<void> {
    return this.confirmAction
      .confirm({
        title: 'Conferma creazione servizio',
        message: 'Vuoi creare questo nuovo servizio?',
        confirmText: 'Crea',
        cancelText: 'Annulla'
      })
      .then(async (confirmed) => {
        if (!confirmed) return;
        this.assertAdminAction();

        const normalized = this.normalizeServiceInput(service);
        const now = Date.now();
        const newRef = push(ref(this.db, this.path));
        const actorId = String(this.auth.userSig()?.uid ?? '').trim() || 'admin';

        const payload: Service = {
          id: newRef.key!,
          createdAt: now,
          updatedAt: now,
          creatoreId: actorId,
          ...normalized
        };

        try {
          await set(newRef, payload);
          this.ui.success('Servizio creato');
        } catch (err) {
          const message = this.isPermissionDeniedError(err)
            ? 'Permesso negato: verifica regole RTDB su /services.'
            : 'Errore durante la creazione servizio';
          this.ui.error(message);
          throw err;
        }
      });
  }

  deleteService(id: string): Promise<void> {
    return this.confirmAction
      .confirm({
        title: 'Conferma eliminazione',
        message: 'Sei sicuro di voler eliminare questo servizio?',
        confirmText: 'Elimina',
        cancelText: 'Annulla'
      })
      .then(async (confirmed) => {
        if (!confirmed) return;
        this.assertAdminAction();
        try {
          await remove(ref(this.db, `${this.path}/${id}`));
          this.ui.warn('Servizio eliminato');
        } catch (err) {
          const message = this.isPermissionDeniedError(err)
            ? 'Permesso negato: verifica regole RTDB su /services.'
            : 'Errore durante l eliminazione servizio';
          this.ui.error(message);
          throw err;
        }
      });
  }

  updateService(id: string, updatedData: Partial<Service>): Promise<void> {
    return this.confirmAction
      .confirm({
        title: 'Conferma aggiornamento',
        message: 'Vuoi salvare le modifiche del servizio?',
        confirmText: 'Salva',
        cancelText: 'Annulla'
      })
      .then(async (confirmed) => {
        if (!confirmed) return;
        this.assertAdminAction();
        try {
          await update(ref(this.db, `${this.path}/${id}`), {
            ...updatedData,
            updatedAt: Date.now()
          });
          this.ui.success('Servizio aggiornato');
        } catch (err) {
          const message = this.isPermissionDeniedError(err)
            ? 'Permesso negato: verifica regole RTDB su /services.'
            : 'Errore durante l aggiornamento servizio';
          this.ui.error(message);
          throw err;
        }
      });
  }

  getServices(): Observable<Service[]> {
    return new Observable<Service[]>((observer) => {
      const servicesRef = ref(this.db, this.path);

      const unsub = onValue(
        servicesRef,
        (snapshot) => {
          const data = snapshot.val();

          const services: Service[] = data
            ? Object.keys(data).map((key) => ({
                id: key,
                ...data[key],
                visibile: data[key].visibile === true || data[key].visibile === 'true'
              }))
            : [];

          services.sort((a, b) => b.createdAt - a.createdAt);
          observer.next(services);
        },
        (error) => observer.error(error)
      );

      return () => unsub();
    });
  }

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
