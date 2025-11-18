import { Injectable, inject, NgZone } from '@angular/core';
import { Database, ref, push, set, update, remove, onValue, get } from '@angular/fire/database';
import { Observable } from 'rxjs';

export interface StaffMember {
  id?: string;
  name: string;
  role: 'tatuatore' | 'piercer' | 'guest' | 'altro';
  bio?: string;
  photoUrl?: string;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class StaffService {
  private readonly path = 'staff';

  constructor(private db: Database, private zone: NgZone) {}

  getAllStaff(): Observable<StaffMember[]> {
    return new Observable(observer => {
      const staffRef = ref(this.db, this.path);
      onValue(staffRef, (snapshot) => {
        this.zone.run(() => {
          const data = snapshot.val();
          const staff: StaffMember[] = data
            ? Object.keys(data).map(id => ({ id, ...data[id] }))
            : [];
          observer.next(staff);
        });
      });
    });
  }

  addStaff(member: StaffMember): Promise<void> {
    const newRef = push(ref(this.db, this.path));
    return set(newRef, {
      ...member,
      id: newRef.key
    });
  }

  updateStaff(id: string, data: Partial<StaffMember>): Promise<void> {
    return update(ref(this.db, `${this.path}/${id}`), data);
  }

  deleteStaff(id: string): Promise<void> {
    return remove(ref(this.db, `${this.path}/${id}`));
  }

  async getStaffById(id: string): Promise<StaffMember | null> {
    const snapshot = await get(ref(this.db, `${this.path}/${id}`));
    return snapshot.exists() ? { id, ...snapshot.val() } : null;
  }
}
