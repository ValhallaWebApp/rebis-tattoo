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
  updateDoc,
  DocumentData
} from '@angular/fire/firestore';
import { Database, get as getDb, ref as dbRef, update as updateDb } from '@angular/fire/database';
import { of, switchMap, catchError, firstValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { UiFeedbackService } from '../ui/ui-feedback.service';
import { AuditLogService } from '../audit/audit-log.service';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'client' | 'staff' | 'public' | 'guest';
  permissions?: {
    canManageRoles?: boolean;
    canManageBookings?: boolean;
    canManageProjects?: boolean;
    canManageSessions?: boolean;
    canReassignProjectArtist?: boolean;
    canReassignProjectClient?: boolean;
    canViewFinancials?: boolean;
    canManageMessages?: boolean;
    canManageServices?: boolean;
    canManageBonus?: boolean;
    canViewAnalytics?: boolean;
    canViewAuditLogs?: boolean;
    [key: string]: boolean | undefined;
  };
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
  readonly canManageRolesSig = computed(() => this.canManageRoles(this._userSig()));
  readonly isAdminSig = computed(() => this._userSig()?.role === 'admin');
  readonly isStaffSig = computed(() => this._userSig()?.role === 'staff');

  private normalizeAppRole(rawRole: unknown): AppUser['role'] {
    const role = String(rawRole ?? 'public').trim().toLowerCase();
    if (role === 'user') return 'client';
    if (role === 'admin' || role === 'client' || role === 'staff' || role === 'public' || role === 'guest') {
      return role;
    }
    return 'public';
  }

  private normalizePermissions(input: any): AppUser['permissions'] {
    const source = (input && typeof input === 'object') ? input as Record<string, any> : {};
    const normalized: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(source)) {
      normalized[key] = value === true;
    }
    if (normalized['canManageRoles'] === undefined) normalized['canManageRoles'] = false;
    return normalized;
  }

  private adminPermissions(): AppUser['permissions'] {
    return {
      canManageRoles: true,
      canManageBookings: true,
      canManageProjects: true,
      canManageSessions: true,
      canReassignProjectArtist: true,
      canReassignProjectClient: true,
      canViewFinancials: true,
      canManageMessages: true,
      canManageServices: true,
      canManageBonus: true,
      canViewAnalytics: true,
      canViewAuditLogs: true
    };
  }

  private normalizeUser(data: DocumentData | AppUser): AppUser {
    const uid = String((data as any).uid ?? (data as any).id ?? '');
    const role = this.normalizeAppRole((data as any).role);
    const normalizedPermissions = this.normalizePermissions((data as any)?.permissions);
    return {
      ...(data as any),
      uid,
      role,
      permissions: role === 'admin'
        ? { ...this.adminPermissions(), ...normalizedPermissions }
        : normalizedPermissions
    };
  }

  private rolePriority(role: AppUser['role'] | string | undefined): number {
    switch (role) {
      case 'admin':
        return 3;
      case 'staff':
        return 2;
      case 'client':
        return 1;
      default:
        return 0;
    }
  }

  private stripUndefined<T extends Record<string, any>>(input: T): T {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) out[k] = v;
    }
    return out as T;
  }

  private toRtdbUserPatch(uid: string, data: Partial<AppUser>): Record<string, any> {
    return this.stripUndefined({
      id: uid,
      uid,
      email: data.email,
      name: data.name,
      phone: data.phone,
      avatar: data.avatar,
      urlAvatar: data.avatar,
      dateOfBirth: data.dateOfBirth,
      address: data.address,
      city: data.city,
      postalCode: data.postalCode,
      country: data.country,
      isActive: data.isActive,
      updatedAt: new Date().toISOString()
    });
  }

  private async syncUserToRtdb(uid: string, data: Partial<AppUser>): Promise<void> {
    const patch = this.toRtdbUserPatch(uid, data);
    if (Object.keys(patch).length <= 3) return; // only id/uid/updatedAt would be low-value noise
    try {
      await updateDb(dbRef(this.db, `users/${uid}`), patch);
    } catch {
      // Best-effort sync; auth flow must not break on RTDB permission mismatch.
    }
  }

  private async inferProfileFromRtdb(uid: string): Promise<Pick<AppUser, 'role' | 'permissions'>> {
    let inferredRole: AppUser['role'] = 'client';
    let inferredPermissions: AppUser['permissions'] = { canManageRoles: false };

    try {
      const adminSnap = await getDb(dbRef(this.db, `adminUids/${uid}`));
      if (adminSnap.exists() && adminSnap.val() === true) {
        inferredRole = 'admin';
      }
    } catch {
      // Staff users cannot read /adminUids by rules: keep probing other nodes.
    }

    try {
      const userSnap = await getDb(dbRef(this.db, `users/${uid}`));
      if (userSnap.exists()) {
        const roleFromUser = this.normalizeAppRole(userSnap.child('role').val());
        if (this.rolePriority(roleFromUser) > this.rolePriority(inferredRole)) {
          inferredRole = roleFromUser;
        }
        inferredPermissions = this.normalizePermissions(userSnap.child('permissions').val());
      }
    } catch {
      // ignore and fallback
    }

    try {
      const staffSnap = await getDb(dbRef(this.db, `staffProfiles/${uid}`));
      if (staffSnap.exists() && staffSnap.child('isActive').val() !== false && inferredRole !== 'admin') {
        inferredRole = 'staff';
      }
    } catch {
      // ignore and fallback
    }

    if (inferredRole === 'admin') {
      inferredPermissions = { ...this.adminPermissions(), ...inferredPermissions };
    }

    return { role: inferredRole, permissions: inferredPermissions };
  }

  private async ensureUserProfile(firebaseUser: User): Promise<AppUser | null> {
    const userRef = doc(this.firestore, 'users', firebaseUser.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const current = this.normalizeUser({ id: firebaseUser.uid, uid: firebaseUser.uid, ...snap.data() });
      const inferred = await this.inferProfileFromRtdb(firebaseUser.uid);

      const roleNeedsUpgrade = this.rolePriority(inferred.role) > this.rolePriority(current.role);
      const permissionNeedsUpgrade =
        inferred.permissions?.canManageRoles === true &&
        current.permissions?.canManageRoles !== true;

      if (roleNeedsUpgrade || permissionNeedsUpgrade) {
        const patch: Partial<AppUser> = {};
        if (roleNeedsUpgrade) patch.role = inferred.role;
        if (permissionNeedsUpgrade) patch.permissions = inferred.permissions;
        try {
          await updateDoc(userRef, patch as any);
        } catch {
          // Keep runtime role aligned even if Firestore rules block profile role updates.
        }
        return {
          ...current,
          ...patch
        };
      }

      await this.syncUserToRtdb(firebaseUser.uid, current);
      return current;
    }

    const inferred = await this.inferProfileFromRtdb(firebaseUser.uid);
    const profile: AppUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? '',
      name: firebaseUser.displayName ?? '',
      role: inferred.role,
      permissions: inferred.permissions,
      isActive: true
    };

    try {
      await setDoc(userRef, { id: firebaseUser.uid, ...profile }, { merge: true });
    } catch {
      // Keep login usable even if profile bootstrap write is denied by rules.
    }
    await this.syncUserToRtdb(firebaseUser.uid, profile);
    return profile;
  }

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private db: Database,
    private router: Router,
    private ui: UiFeedbackService,
    private audit: AuditLogService
  ) {
    // Listener che resta attivo e ripristina la sessione al reload
    const user$ = authState(this.auth).pipe(
      switchMap((firebaseUser: User | null) => {
        if (!firebaseUser) {
          this._userSig.set(null);
          return of(null);
        }
        return this.ensureUserProfile(firebaseUser).then(profile => {
          if (profile) {
            this._userSig.set(profile);
            return profile;
          }
          this._userSig.set(null);
          return null;
        }).catch(() => {
          this._userSig.set(null);
          return null;
        });
      }),
      catchError(() => of(null))
    );
    toSignal(user$, { initialValue: null });
  }

  async login(email: string, password: string) {
    try {
      const cred = await signInWithEmailAndPassword(this.auth, email, password);
      // Resolve profile through the same normalization/upgrade path used by authState,
      // avoiding role races between Firestore snapshot and RTDB-derived role.
      const profile = await this.ensureUserProfile(cred.user);
      this._userSig.set(profile);

      void this.audit.log({
        action: 'auth.login',
        resource: 'auth',
        status: 'success',
        actorId: profile?.uid ?? cred.user.uid,
        actorRole: profile?.role,
        targetUserId: cred.user.uid,
        meta: { email }
      });
    } catch (error: any) {
      void this.audit.log({
        action: 'auth.login',
        resource: 'auth',
        status: 'error',
        message: String(error?.code ?? error?.message ?? 'unknown_error'),
        meta: { email }
      });
      throw error;
    }
  }

  async register(email: string, password: string) {
    try {
      const cred = await createUserWithEmailAndPassword(this.auth, email, password);
      const profile: AppUser = {
        uid: cred.user.uid,
        email,
        name: '',
        role: 'client',
        isActive: true
      };
      await setDoc(doc(this.firestore, 'users', cred.user.uid), { id: cred.user.uid, ...profile });
      await this.syncUserToRtdb(cred.user.uid, profile);
      this._userSig.set(profile);
      void this.audit.log({
        action: 'auth.register',
        resource: 'user',
        resourceId: profile.uid,
        status: 'success',
        actorId: profile.uid,
        actorRole: profile.role,
        targetUserId: profile.uid,
        meta: { email }
      });
    } catch (error: any) {
      void this.audit.log({
        action: 'auth.register',
        resource: 'user',
        status: 'error',
        message: String(error?.code ?? error?.message ?? 'unknown_error'),
        meta: { email }
      });
      throw error;
    }
  }

  async logout() {
    const current = this._userSig();
    await signOut(this.auth);
    this._userSig.set(null);
    void this.audit.log({
      action: 'auth.logout',
      resource: 'auth',
      status: 'success',
      actorId: current?.uid,
      actorRole: current?.role
    });
    this.router.navigate(['/login']);
  }

  getUser(): AppUser | null {
    return this._userSig();
  }

  canManageRoles(user: AppUser | null | undefined = this._userSig()): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.permissions?.canManageRoles === true;
  }

  async resolveCurrentUser(): Promise<AppUser | null> {
    const current = this._userSig();
    if (current) return current;

    const firebaseUser = this.auth.currentUser ?? await firstValueFrom(authState(this.auth));
    if (!firebaseUser) {
      this._userSig.set(null);
      return null;
    }

    const profile = await this.ensureUserProfile(firebaseUser);
    this._userSig.set(profile);
    return profile;
  }

  async updateCurrentUserProfile(data: Partial<AppUser>): Promise<void> {
    const current = this._userSig();
    if (!current) throw new Error('Nessun utente loggato');

    try {
      const ref = doc(this.firestore, 'users', current.uid);
      await updateDoc(ref, data);
      await this.syncUserToRtdb(current.uid, { ...current, ...data });
      this._userSig.set({ ...current, ...data });
      void this.audit.log({
        action: 'user.profile.update',
        resource: 'user',
        resourceId: current.uid,
        status: 'success',
        actorId: current.uid,
        actorRole: current.role,
        targetUserId: current.uid,
        meta: { changedKeys: Object.keys(data ?? {}) }
      });
      this.ui.success('Profilo aggiornato');
    } catch (error) {
      void this.audit.log({
        action: 'user.profile.update',
        resource: 'user',
        resourceId: current.uid,
        status: 'error',
        actorId: current.uid,
        actorRole: current.role,
        targetUserId: current.uid,
        meta: { changedKeys: Object.keys(data ?? {}) }
      });
      this.ui.error('Errore aggiornamento profilo');
      throw error;
    }
  }
}
