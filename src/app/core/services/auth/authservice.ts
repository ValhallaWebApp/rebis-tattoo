import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import {
  Auth,
  authState,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from '@angular/fire/firestore';
import { of, switchMap, catchError } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: string;
  isActive?: boolean;

  phone?: string;
  avatar?: string;
  dateOfBirth?: any;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}


@Injectable({ providedIn: 'root' })
export class AuthService {
  private _userSig = signal<AppUser | null>(null);
  readonly userSig = this._userSig;
  readonly isLoggedInSig = computed(() => !!this._userSig());
  readonly roleSig = computed(() => this._userSig()?.role || 'public');

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private router: Router
  ) {
    // Listener che resta attivo e ripristina la sessione al reload
    const user$ = authState(this.auth).pipe(
      switchMap((firebaseUser: User | null) => {
        if (!firebaseUser) {
          this._userSig.set(null);
          return of(null);
        }
        const ref = doc(this.firestore, 'users', firebaseUser.uid);
        return getDoc(ref).then(snap => {
          if (snap.exists()) {
            const data = snap.data() as AppUser;
            this._userSig.set(data);
            return data;
          }
          return null;
        }).catch(() => null);
      }),
      catchError(() => of(null))
    );
    toSignal(user$, { initialValue: null });
  }

  async login(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    const ref = doc(this.firestore, 'users', cred.user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      this._userSig.set(snap.data() as AppUser);
    }
  }

  async register(email: string, password: string) {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    const profile: AppUser = {
      uid: cred.user.uid,
      email,
      name: '',
      role: 'user',
      isActive: true
    };
    await setDoc(doc(this.firestore, 'users', cred.user.uid), profile);
    this._userSig.set(profile);
  }

  async logout() {
    await signOut(this.auth);
    this._userSig.set(null);
    this.router.navigate(['/login']);
  }

  getUser(): AppUser | null {
    return this._userSig();
  }
    async updateCurrentUserProfile(data: Partial<AppUser>): Promise<void> {
    const current = this._userSig();
    if (!current) throw new Error('Nessun utente loggato');

    const ref = doc(this.firestore, 'users', current.uid);
    await updateDoc(ref, data);
    this._userSig.set({ ...current, ...data });
  }
}
