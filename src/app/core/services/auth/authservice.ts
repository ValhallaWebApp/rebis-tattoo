import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Auth,
  authState,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from '@angular/fire/auth';
import { Database, get as getDb, ref as dbRef, set as setDb, update as updateDb } from '@angular/fire/database';
import { firstValueFrom } from 'rxjs';
import type { User as BaseUser, UserPermissions, UserRole } from '../users/user.service';

export type AppUser = Omit<BaseUser, 'staffLevel' | 'permissions' | 'deletedAt' | 'createdAt' | 'updatedAt' | 'isActive' | 'isVisible' | 'urlAvatar'> & {
  id: string;
  uid: string;
  role: UserRole;
  permissions: UserPermissions;
  staffLevel: string;
  phone: string;
  isActive: boolean;
  isVisible: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  urlAvatar: string;
  avatar: string;
  dateOfBirth: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
};

export interface RegisterResult {
  profile: AppUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly flowLogEnabled = true;
  private readonly _userSig = signal<AppUser | null>(null);
  private readonly _profileWarningSig = signal<string | null>(null);
  readonly userSig = this._userSig;
  readonly isLoggedInSig = computed(() => !!this._userSig());
  readonly roleSig = computed(() => this._userSig()?.role || 'guest');
  readonly canManageRolesSig = computed(() => this.canManageRoles(this._userSig()));
  readonly isAdminSig = computed(() => this._userSig()?.role === 'admin');
  readonly isStaffSig = computed(() => this._userSig()?.role === 'staff');

  private flowLog(step: string, data?: Record<string, unknown>): void {
    if (!this.flowLogEnabled) return;
    if (data) {
      console.info(`[AuthFlow] ${step}`, data);
      return;
    }
    console.info(`[AuthFlow] ${step}`);
  }

  private flowError(step: string, err: unknown, data?: Record<string, unknown>): void {
    if (!this.flowLogEnabled) return;
    console.error(`[AuthFlow] ${step}`, {
      ...(data ?? {}),
      code: (err as any)?.code,
      message: (err as any)?.message
    });
  }

  private isPermissionDeniedError(err: unknown): boolean {
    const code = String((err as any)?.code ?? '').toLowerCase();
    const msg = String((err as any)?.message ?? '').toLowerCase();
    return code.includes('permission-denied') || msg.includes('permission_denied') || msg.includes('permission denied');
  }

  constructor(
    private auth: Auth,
    private db: Database,
    private router: Router,
  ) {
    authState(this.auth).subscribe(async (firebaseUser) => {
      if (!firebaseUser) {
        this._userSig.set(null);
        return;
      }

      try {
        const profile = await this.loadUserProfile(firebaseUser.uid, { allowIncomplete: true });
        this._userSig.set(profile);
      } catch {
        this._userSig.set(null);
      }
    });
  }

  private defaultPermissions(): UserPermissions {
    return {
      canManageRoles: false,
      canManageBookings: false,
      canManageProjects: false,
      canManageSessions: false,
      canReassignProjectArtist: false,
      canReassignProjectClient: false,
      canViewFinancials: false,
      canManageMessages: false,
      canManageServices: false,
      canManageBonus: false,
      canViewAnalytics: false,
      canViewAuditLogs: false,
    };
  }

  private toStringValue(value: unknown): string {
    const v = String(value ?? '').trim();
    return v.length > 0 ? v : '-';
  }

  private toBooleanValue(value: unknown): boolean {
    return value === true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildRegisterPayload(uid: string, email: string, payload: Partial<AppUser>): AppUser {
    const now = new Date().toISOString();
    const permissions = { ...this.defaultPermissions() };
    return {
      id: uid,
      uid,
      name: this.toStringValue(payload.name),
      email: this.toStringValue(email),
      role: 'client',
      staffLevel: '-',
      permissions,
      phone: this.toStringValue(payload.phone),
      isActive: this.toBooleanValue(payload.isActive),
      isVisible: this.toBooleanValue(payload.isVisible),
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      urlAvatar: this.toStringValue(payload.urlAvatar ?? payload.avatar),
      avatar: this.toStringValue(payload.avatar ?? payload.urlAvatar),
      dateOfBirth: this.toStringValue(payload.dateOfBirth),
      address: this.toStringValue(payload.address),
      city: this.toStringValue(payload.city),
      postalCode: this.toStringValue(payload.postalCode),
      country: this.toStringValue(payload.country),
    };
  }

  private hasCompleteUserRecord(raw: any, uid: string): boolean {
    if (!raw || typeof raw !== 'object') return false;

    const requiredKeys = [
      'id', 'uid', 'name', 'email', 'role', 'staffLevel', 'permissions',
      'phone', 'isActive', 'isVisible', 'createdAt', 'updatedAt',
      'urlAvatar', 'avatar', 'dateOfBirth', 'address', 'city', 'postalCode', 'country'
    ];

    for (const key of requiredKeys) {
      if (!(key in raw)) return false;
    }

    if (String(raw.id) !== uid) return false;
    if (String(raw.uid) !== uid) return false;
    if (typeof raw.email !== 'string' || raw.email.trim().length === 0) return false;
    if (typeof raw.name !== 'string' || raw.name.trim().length === 0) return false;
    if (!raw.permissions || typeof raw.permissions !== 'object') return false;

    return true;
  }

  private getMissingUserFields(raw: any, uid: string): string[] {
    const requiredKeys = [
      'id', 'uid', 'name', 'email', 'role', 'staffLevel', 'permissions',
      'phone', 'isActive', 'isVisible', 'createdAt', 'updatedAt',
      'urlAvatar', 'avatar', 'dateOfBirth', 'address', 'city', 'postalCode', 'country'
    ];
    if (!raw || typeof raw !== 'object') return [...requiredKeys];
    const missing = requiredKeys.filter((k) => !(k in raw));
    if (String(raw.id ?? '') !== uid) missing.push('id');
    if (String(raw.uid ?? '') !== uid) missing.push('uid');
    return Array.from(new Set(missing));
  }

  private normalizeProfile(raw: any, uid: string): AppUser {
    const permissions = {
      ...this.defaultPermissions(),
      ...(raw?.permissions ?? {}),
    } as UserPermissions;

    return {
      id: uid,
      uid,
      name: this.toStringValue(raw?.name),
      email: this.toStringValue(raw?.email),
      role: (this.toStringValue(raw?.role) as UserRole),
      staffLevel: this.toStringValue(raw?.staffLevel),
      permissions,
      phone: this.toStringValue(raw?.phone),
      isActive: this.toBooleanValue(raw?.isActive),
      isVisible: this.toBooleanValue(raw?.isVisible),
      deletedAt: raw?.deletedAt === null ? null : this.toStringValue(raw?.deletedAt),
      createdAt: this.toStringValue(raw?.createdAt),
      updatedAt: this.toStringValue(raw?.updatedAt),
      urlAvatar: this.toStringValue(raw?.urlAvatar),
      avatar: this.toStringValue(raw?.avatar ?? raw?.urlAvatar),
      dateOfBirth: this.toStringValue(raw?.dateOfBirth),
      address: this.toStringValue(raw?.address),
      city: this.toStringValue(raw?.city),
      postalCode: this.toStringValue(raw?.postalCode),
      country: this.toStringValue(raw?.country),
    };
  }

  private async loadUserProfile(uid: string, opts?: { allowIncomplete?: boolean }): Promise<AppUser> {
    this.flowLog('loadUserProfile.start', { uid });
    const snap = await getDb(dbRef(this.db, `users/${uid}`));
    if (!snap.exists()) {
      this.flowLog('loadUserProfile.not_found', { uid });
      throw new Error('profile/not-found');
    }

    const raw = snap.val();
    if (!this.hasCompleteUserRecord(raw, uid)) {
      const missing = this.getMissingUserFields(raw, uid);
      this.flowLog('loadUserProfile.incomplete', { uid, keys: Object.keys(raw ?? {}), missing });
      if (opts?.allowIncomplete) {
        this._profileWarningSig.set(missing.join(', '));
        return this.normalizeProfile(raw, uid);
      }
      throw new Error('profile/incomplete');
    }

    this._profileWarningSig.set(null);
    this.flowLog('loadUserProfile.success', { uid });
    return this.normalizeProfile(raw, uid);
  }

  private async waitForAuthUid(expectedUid: string, timeoutMs = 5000): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt <= timeoutMs) {
      const currentUid = String(this.auth.currentUser?.uid ?? '').trim();
      if (currentUid === expectedUid) return true;
      try {
        const user = await firstValueFrom(authState(this.auth));
        if (String(user?.uid ?? '').trim() === expectedUid) return true;
      } catch {
        // ignore transient auth stream errors
      }
      await this.sleep(250);
    }
    return false;
  }

  private async setUserRecordWithRetry(uid: string, userPayload: AppUser): Promise<void> {
    const maxAttempts = 6;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.flowLog('register.rtdb_set.attempt', { uid, attempt, maxAttempts });
        await setDb(dbRef(this.db, `users/${uid}`), userPayload);
        this.flowLog('register.rtdb_set.success', { uid, attempt });
        return;
      } catch (err) {
        this.flowError('register.rtdb_set.error', err, { uid, attempt, maxAttempts });
        if (!this.isPermissionDeniedError(err) || attempt === maxAttempts) {
          throw err;
        }
        await this.sleep(300 * attempt);
      }
    }
  }

  async register(email: string, password: string, payload: Partial<AppUser>): Promise<RegisterResult> {
    this.flowLog('register.start', { email });
    try {
      const cred = await createUserWithEmailAndPassword(this.auth, email, password);
      const uid = String(cred?.user?.uid ?? '').trim();
      this.flowLog('register.auth_created', { uid, email });

      if (!uid) {
        throw new Error('auth/missing-uid');
      }

      try {
        const token = await cred.user.getIdToken(true);
        this.flowLog('register.token_refreshed', { uid, tokenLen: token?.length ?? 0 });
      } catch (tokenErr) {
        this.flowError('register.token_refresh_error', tokenErr, { uid });
      }

      const authReady = await this.waitForAuthUid(uid, 6000);
      this.flowLog('register.auth_uid_ready', { uid, authReady, currentAuthUid: this.auth.currentUser?.uid ?? null });
      if (!authReady) {
        throw new Error('auth/uid-not-ready');
      }

      const userPayload = this.buildRegisterPayload(uid, email, payload ?? {});
      this.flowLog('register.rtdb_set.start', { uid, keys: Object.keys(userPayload) });
      await this.setUserRecordWithRetry(uid, userPayload);

      const existsAfterWrite = await this.waitForUserRecord(uid, 9000, 450);
      this.flowLog('register.rtdb_postcheck', { uid, existsAfterWrite });
      if (!existsAfterWrite) {
        throw new Error('profile/not-persisted');
      }

      const profile = await this.loadUserProfile(uid, { allowIncomplete: true });
      this._userSig.set(profile);
      this.flowLog('register.success', { uid, role: profile.role });
      return { profile };
    } catch (err) {
      this.flowError('register.error', err, { email });
      throw err;
    }
  }

  async login(email: string, password: string): Promise<void> {
    this.flowLog('login.start', { email });
    try {
      const cred = await signInWithEmailAndPassword(this.auth, email, password);
      const uid = String(cred?.user?.uid ?? '').trim();
      this.flowLog('login.auth_success', { uid, email });
      if (!uid) {
        throw new Error('auth/missing-uid');
      }
      const profile = await this.loadUserProfile(uid, { allowIncomplete: true });
      this._userSig.set(profile);
      this.flowLog('login.success', { uid, role: profile.role });
    } catch (err) {
      this.flowError('login.error', err, { email });
      throw err;
    }
  }

  async logout(): Promise<void> {
    this.flowLog('logout.start', { uid: this._userSig()?.uid });
    try {
      await signOut(this.auth);
      this._userSig.set(null);
      await this.router.navigate(['/login']);
      this.flowLog('logout.success');
    } catch (err) {
      this.flowError('logout.error', err);
      throw err;
    }
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

    const profile = await this.loadUserProfile(firebaseUser.uid, { allowIncomplete: true });
    this._userSig.set(profile);
    return profile;
  }

  async updateCurrentUserProfile(data: Partial<AppUser>): Promise<void> {
    const current = this._userSig();
    if (!current) throw new Error('auth/not-logged-in');

    const patch: Partial<AppUser> = {
      name: data.name !== undefined ? this.toStringValue(data.name) : undefined,
      phone: data.phone !== undefined ? this.toStringValue(data.phone) : undefined,
      avatar: data.avatar !== undefined ? this.toStringValue(data.avatar) : undefined,
      urlAvatar: data.urlAvatar !== undefined ? this.toStringValue(data.urlAvatar) : undefined,
      dateOfBirth: data.dateOfBirth !== undefined ? this.toStringValue(data.dateOfBirth) : undefined,
      address: data.address !== undefined ? this.toStringValue(data.address) : undefined,
      city: data.city !== undefined ? this.toStringValue(data.city) : undefined,
      postalCode: data.postalCode !== undefined ? this.toStringValue(data.postalCode) : undefined,
      country: data.country !== undefined ? this.toStringValue(data.country) : undefined,
      updatedAt: new Date().toISOString(),
    };

    await updateDb(dbRef(this.db, `users/${current.uid}`), patch as any);
    this._userSig.set({ ...current, ...patch } as AppUser);
  }

  consumeProfileWarning(): string | null {
    const warning = this._profileWarningSig();
    this._profileWarningSig.set(null);
    return warning;
  }

  async waitForUserRecord(uid: string, timeoutMs = 8000, intervalMs = 350): Promise<boolean> {
    const safeUid = String(uid ?? '').trim();
    if (!safeUid) return false;

    this.flowLog('waitForUserRecord.start', { uid: safeUid, timeoutMs, intervalMs });
    const startedAt = Date.now();
    while (Date.now() - startedAt <= timeoutMs) {
      try {
        const snap = await getDb(dbRef(this.db, `users/${safeUid}`));
        const ok = snap.exists() && this.hasCompleteUserRecord(snap.val(), safeUid);
        if (ok) {
          this.flowLog('waitForUserRecord.success', { uid: safeUid });
          return true;
        }
      } catch (err) {
        this.flowError('waitForUserRecord.error', err, { uid: safeUid });
        return false;
      }
      await this.sleep(intervalMs);
    }
    this.flowLog('waitForUserRecord.timeout', { uid: safeUid });
    return false;
  }
}
