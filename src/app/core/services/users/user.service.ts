import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { Database, get as getDb, onValue, ref, update as updateDb } from '@angular/fire/database';
import { catchError, map, Observable, of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { UiFeedbackService } from '../ui/ui-feedback.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ConfirmActionService } from '../ui/confirm-action.service';
import { environment } from '../../../../environment';
import { mapHttpError } from '../../http/http-error.mapper';
import { withCriticalHttpPolicy } from '../../http/http-policy';
import {
  StaffSyncProfileRequestDto,
  StaffSyncProfileResponseDto
} from '../../models/api/payment-bridge.dto';

export type UserRole = 'admin' | 'staff' | 'client' | 'user' | 'guest' | 'public';

export interface UserPermissions {
  canManageRoles?: boolean;
  canManageBookings?: boolean;
  canManageProjects?: boolean;
  canManageEvents?: boolean;
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
}

export type StaffLevel = 'junior' | 'operator' | 'senior' | 'manager';

export interface User {
  id: string;
  /** @deprecated usa `id` come chiave utente */
  uid?: string;
  name: string;
  email: string;
  role: UserRole;
  staffLevel?: StaffLevel;
  permissions?: UserPermissions;
  phone?: string;
  isActive?: boolean;
  isVisible?: boolean;
  deletedAt?: string | null;
  createdAt: string | number | null;
  updatedAt?: string | number | null;
  urlAvatar: string | null;
  // altri campi...
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private db = inject(Database);
  private http = inject(HttpClient);
  private firebaseAuth = inject(Auth);
  private auth = inject(AuthService);
  private ui = inject(UiFeedbackService);
  private audit = inject(AuditLogService);
  private confirmAction = inject(ConfirmActionService);
  private readonly paymentApiBaseUrl = environment.paymentApiBaseUrl.replace(/\/+$/, '');

  private normalizePermissions(input: unknown): UserPermissions {
    const source = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
    const normalized: UserPermissions = {};
    for (const [key, value] of Object.entries(source)) {
      normalized[key] = value === true;
    }
    if (normalized.canManageRoles === undefined) normalized.canManageRoles = false;
    return normalized;
  }

  constructor() {}

  private normalizeDeletedAt(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    if (!s || s === '-' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return null;
    return s;
  }

  private normalizeTemporal(value: unknown): string | number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'number') return value;
    return String(value);
  }

  private normalizeOptionalString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text ? text : null;
  }

  private isVisibleAndNotDeleted(user: Pick<User, 'isVisible' | 'deletedAt'>): boolean {
    return user.isVisible !== false && !this.normalizeDeletedAt(user.deletedAt);
  }

  private normalizeUser(input: unknown): User {
    const raw = (input ?? {}) as Record<string, unknown>;
    const canonicalId = String(raw['id'] ?? raw['uid'] ?? '').trim();
    const { uid: _uid, ...rest } = raw;

    return {
      ...(rest as Record<string, unknown>),
      id: canonicalId,
      name: String(raw['name'] ?? ''),
      email: String(raw['email'] ?? ''),
      role: (String(raw['role'] ?? 'guest') as UserRole),
      staffLevel: (raw['staffLevel'] as StaffLevel | undefined),
      permissions: this.normalizePermissions(raw['permissions']),
      phone: raw['phone'] ? String(raw['phone']) : undefined,
      isActive: raw['isActive'] !== undefined ? Boolean(raw['isActive']) : undefined,
      isVisible: raw['isVisible'] !== undefined ? Boolean(raw['isVisible']) : undefined,
      deletedAt: this.normalizeDeletedAt(raw['deletedAt']),
      createdAt: this.normalizeTemporal(raw['createdAt']),
      updatedAt: this.normalizeTemporal(raw['updatedAt']),
      urlAvatar: this.normalizeOptionalString(raw['urlAvatar'] ?? raw['avatar'])
    };
  }

  private streamRtdbUsers(): Observable<User[]> {
    return new Observable<User[]>((observer) => {
      const usersRef = ref(this.db, 'users');
      const unsub = onValue(
        usersRef,
        (snap) => {
          if (!snap.exists()) {
            observer.next([]);
            return;
          }
          const raw = snap.val() as Record<string, unknown>;
          const list = Object.entries(raw).map(([id, value]) => this.normalizeUser({ id, ...(value as Record<string, unknown>) }));
          observer.next(list);
        },
        (err) => observer.error(err)
      );
      return () => unsub();
    }).pipe(catchError(() => of([])));
  }

  getCurrentUserId(): string | null {
    return this.auth.userSig()?.uid || null;
  }

  getCurrentUserRole(): UserRole {
    return this.auth.userSig()?.role || 'guest';
  }

  isCurrentUserAdmin(): boolean {
    return this.getCurrentUserRole() === 'admin';
  }

  getAssignableRolesForCurrentUser(): Array<'admin' | 'client' | 'staff'> {
    if (!this.isCurrentUserAdmin()) return [];
    return ['admin', 'client', 'staff'];
  }

  private assertAdminAction(): void {
    if (!this.isCurrentUserAdmin()) {
      throw new Error('Azione consentita solo ad admin');
    }
  }

  private isPermissionDeniedError(err: unknown): boolean {
    const payload = err as { code?: unknown; message?: unknown } | null;
    const code = String(payload?.code ?? '').toLowerCase();
    const msg = String(payload?.message ?? '').toLowerCase();
    return code.includes('permission-denied') || msg.includes('permission_denied') || msg.includes('permission denied');
  }

  private buildUpdateSuccessMessage(patch: Partial<User>): string {
    if ('role' in (patch ?? {})) return 'Ruolo utente aggiornato';
    if ('isActive' in (patch ?? {})) {
      return patch.isActive === false ? 'Utente disattivato' : 'Utente attivato';
    }
    if ('permissions' in (patch ?? {})) return 'Permessi utente aggiornati';
    return 'Utente aggiornato';
  }

  private async confirmUpdateAction(patch: Partial<User>): Promise<boolean> {
    if ('role' in (patch ?? {})) {
      return this.confirmAction.confirm({
        title: 'Conferma cambio ruolo',
        message: 'Vuoi confermare il cambio ruolo di questo utente?',
        confirmText: 'Conferma',
        cancelText: 'Annulla',
      });
    }
    if ('isActive' in (patch ?? {})) {
      const activating = patch.isActive !== false;
      return this.confirmAction.confirm({
        title: activating ? 'Conferma attivazione' : 'Conferma disattivazione',
        message: activating
          ? 'Vuoi attivare questo utente?'
          : 'Vuoi disattivare questo utente?',
        confirmText: 'Conferma',
        cancelText: 'Annulla',
      });
    }
    if ('permissions' in (patch ?? {})) {
      return this.confirmAction.confirm({
        title: 'Conferma aggiornamento permessi',
        message: 'Vuoi salvare i nuovi permessi utente?',
        confirmText: 'Conferma',
        cancelText: 'Annulla',
      });
    }
    return this.confirmAction.confirm({
      title: 'Conferma aggiornamento',
      message: 'Vuoi salvare le modifiche utente?',
      confirmText: 'Salva',
      cancelText: 'Annulla',
    });
  }

  getClients(): Observable<User[]> {
    const uid = this.getCurrentUserId();
    const role = this.getCurrentUserRole();
    const rtdb$ = this.streamRtdbUsers();

    if (role === 'admin') {
      return rtdb$.pipe(
        map(users => users
          .filter(u => u.role === 'client')
          .filter(user => this.isVisibleAndNotDeleted(user))
        )
      );
    }

    if (uid) {
      return rtdb$.pipe(map(users => users.filter(u => u.id === uid)));
    }

    return of([]); // non autenticato
  }

  getManageableUsers(): Observable<User[]> {
    if (!this.isCurrentUserAdmin()) return of([]);

    return this.streamRtdbUsers().pipe(
      map(users => users.filter(u => ['user', 'client', 'staff', 'admin'].includes(u.role))),
      map(users => users.filter(user => this.isVisibleAndNotDeleted(user)))
    );
  }

  private isVisibleUser(data: Record<string, unknown> | undefined): boolean {
    if (!data) return false;
    return data['isVisible'] !== false && !data['deletedAt'];
  }

  private async syncStaffProfileForRoleChange(
    userId: string,
    currentUser: Record<string, unknown>,
    nextUser: Record<string, unknown>,
    prevRole: string,
    nextRole: string,
    nowIso: string
  ): Promise<void> {
    const profileRef = ref(this.db, `staffProfiles/${userId}`);
    const publicRef = ref(this.db, `publicStaff/${userId}`);
    const normalizedPrevRole = String(prevRole ?? '').toLowerCase();
    const normalizedNextRole = String(nextRole ?? '').toLowerCase();

    if (normalizedPrevRole !== 'staff' && normalizedNextRole === 'staff') {
      const profileSnap = await getDb(profileRef);
      const existing = (profileSnap.exists() ? profileSnap.val() : {}) as Record<string, unknown>;
      const staffProfilePatch: Record<string, unknown> = {
        id: userId,
        userId,
        name: String(nextUser['name'] ?? currentUser['name'] ?? '').trim() || userId,
        role: String(existing['role'] ?? 'altro'),
        bio: String(existing['bio'] ?? ''),
        photoUrl: String(nextUser['urlAvatar'] ?? currentUser['urlAvatar'] ?? ''),
        email: String(nextUser['email'] ?? currentUser['email'] ?? ''),
        phone: String(nextUser['phone'] ?? currentUser['phone'] ?? ''),
        isActive: nextUser['isActive'] !== false,
        deletedAt: null,
      };
      await updateDb(profileRef, staffProfilePatch);

      const publicStaffPatch: Record<string, unknown> = {
        id: userId,
        userId,
        name: String(nextUser['name'] ?? currentUser['name'] ?? '').trim() || userId,
        role: 'staff',
        bio: String(existing['bio'] ?? ''),
        photoUrl: String(nextUser['urlAvatar'] ?? currentUser['urlAvatar'] ?? ''),
        email: String(nextUser['email'] ?? currentUser['email'] ?? ''),
        phone: String(nextUser['phone'] ?? currentUser['phone'] ?? ''),
        isActive: nextUser['isActive'] !== false,
        deletedAt: null,
      };
      await updateDb(publicRef, publicStaffPatch);
      return;
    }

    if (normalizedPrevRole === 'staff' && normalizedNextRole !== 'staff') {
      const disablePatch: Record<string, unknown> = { isActive: false, deletedAt: nowIso };
      await updateDb(profileRef, disablePatch);
      await updateDb(publicRef, disablePatch);
      return;
    }

    if (normalizedNextRole === 'staff') {
      const staffProfileUpdatePatch: Record<string, unknown> = {
        name: String(nextUser['name'] ?? currentUser['name'] ?? '').trim(),
        photoUrl: String(nextUser['urlAvatar'] ?? currentUser['urlAvatar'] ?? ''),
        email: String(nextUser['email'] ?? currentUser['email'] ?? ''),
        phone: String(nextUser['phone'] ?? currentUser['phone'] ?? ''),
        isActive: nextUser['isActive'] !== false,
      };
      await updateDb(profileRef, staffProfileUpdatePatch);

      const publicStaffUpdatePatch: Record<string, unknown> = {
        id: userId,
        userId,
        name: String(nextUser['name'] ?? currentUser['name'] ?? '').trim(),
        role: 'staff',
        photoUrl: String(nextUser['urlAvatar'] ?? currentUser['urlAvatar'] ?? ''),
        email: String(nextUser['email'] ?? currentUser['email'] ?? ''),
        phone: String(nextUser['phone'] ?? currentUser['phone'] ?? ''),
        isActive: nextUser['isActive'] !== false,
        deletedAt: null,
      };
      await updateDb(publicRef, publicStaffUpdatePatch);
    }
  }

  private async syncStaffProfileForRoleChangeViaBackend(
    userId: string,
    currentUser: Record<string, unknown>,
    nextUser: Record<string, unknown>,
    prevRole: string,
    nextRole: string,
    nowIso: string
  ): Promise<void> {
    const token = await this.firebaseAuth.currentUser?.getIdToken();
    if (!token) throw new Error('missing-auth-token');

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const request: StaffSyncProfileRequestDto = {
      userId,
      currentUser,
      nextUser,
      prevRole,
      nextRole,
      nowIso
    };

    let response: StaffSyncProfileResponseDto;
    try {
      response = await firstValueFrom(
        this.http.post<StaffSyncProfileResponseDto>(
          `${this.paymentApiBaseUrl}/staff/sync-profile`,
          request,
          { headers }
        ).pipe(withCriticalHttpPolicy())
      );
    } catch (error) {
      const mapped = mapHttpError(error, {
        fallbackMessage: 'Errore sincronizzazione profilo staff.',
        timeoutMessage: 'Timeout sincronizzazione profilo staff.',
        networkMessage: 'Backend sync staff non raggiungibile.'
      });
      throw new Error(mapped.message);
    }

    if (!response?.success) {
      throw new Error('invalid-backend-sync-response');
    }
  }

  private shouldSyncStaffProfile(
    patch: Partial<User>,
    currentRole: string,
    nextRole: string
  ): boolean {
    const prevIsStaff = String(currentRole ?? '').toLowerCase() === 'staff';
    const nextIsStaff = String(nextRole ?? '').toLowerCase() === 'staff';
    if (!prevIsStaff && !nextIsStaff) return false;
    if (prevIsStaff !== nextIsStaff) return true;

    const syncKeys: Array<keyof User> = [
      'name',
      'email',
      'phone',
      'urlAvatar',
      'isActive',
      'isVisible'
    ];
    return syncKeys.some((key) => Object.prototype.hasOwnProperty.call(patch ?? {}, key));
  }

  async getVisibleAdminCount(excludeUserId?: string): Promise<number> {
    const snap = await getDb(ref(this.db, 'users'));
    if (!snap.exists()) return 0;
    const users = Object.entries((snap.val() ?? {}) as Record<string, unknown>);
    return users.reduce((acc, [id, raw]) => {
      if (excludeUserId && id === excludeUserId) return acc;
      const data = (raw ?? {}) as Record<string, unknown>;
      if (String(data['role'] ?? '') !== 'admin') return acc;
      if (this.isVisibleUser(data)) return acc + 1;
      return acc;
    }, 0);
  }

  async updateUser(userId: string, patch: Partial<User>): Promise<void> {
    const actor = this.auth.userSig();
    try {
      this.assertAdminAction();
      const confirmed = await this.confirmUpdateAction(patch);
      if (!confirmed) return;

      const userRef = ref(this.db, `users/${userId}`);
      const currentSnap = await getDb(userRef);
      const current = (currentSnap.val() ?? {}) as Record<string, unknown>;
      const nowIso = new Date().toISOString();
      const currentRole = String(current['role'] ?? '');
      const nextRole = patch.role ? String(patch.role) : currentRole;
      if (actor?.uid === userId && nextRole && nextRole !== currentRole) {
        throw new Error('Non puoi cambiare il tuo ruolo');
      }

      if (currentRole === 'admin' && nextRole && nextRole !== 'admin') {
        const adminCount = await this.getVisibleAdminCount();
        if (adminCount <= 1) {
          throw new Error('Impossibile rimuovere il ruolo all ultimo admin');
        }
      }

      const safePatch: Record<string, unknown> = { ...(patch as Record<string, unknown>), updatedAt: nowIso };
      if (String(nextRole).toLowerCase() === 'staff') {
        safePatch['deletedAt'] = null;
        if (safePatch['isVisible'] === undefined) safePatch['isVisible'] = true;
        if (safePatch['isActive'] === undefined) safePatch['isActive'] = true;
      }
      delete safePatch['id'];
      delete safePatch['uid'];
      delete safePatch['createdAt'];
      await updateDb(userRef, safePatch);
      let syncWarning: string | null = null;
      const shouldSyncStaff = this.shouldSyncStaffProfile(patch, currentRole, String(nextRole));
      if (shouldSyncStaff) {
        try {
          const mergedUser = {
            ...current,
            ...(safePatch as Record<string, unknown>)
          } as Record<string, unknown>;

          await this.syncStaffProfileForRoleChangeViaBackend(
            userId,
            current,
            mergedUser,
            currentRole,
            String(nextRole),
            nowIso
          );
        } catch (syncErr) {
          try {
            await this.syncStaffProfileForRoleChange(
              userId,
              current,
              { ...current, ...(safePatch as Record<string, unknown>) } as Record<string, unknown>,
              currentRole,
              String(nextRole),
              nowIso
            );
          } catch (fallbackSyncErr) {
            syncWarning = this.isPermissionDeniedError(fallbackSyncErr)
              ? 'Utente aggiornato, ma sincronizzazione staff non consentita dalle regole database.'
              : 'Utente aggiornato, ma sincronizzazione staff non completata.';
            void this.audit.log({
              action: 'user.update.staffSync',
              resource: 'staffProfile',
              resourceId: userId,
              status: 'error',
              actorId: actor?.uid,
              actorRole: actor?.role,
              targetUserId: userId
            });
          }
        }
      }
      void this.audit.log({
        action: 'user.update',
        resource: 'user',
        resourceId: userId,
        status: 'success',
        actorId: actor?.uid,
        actorRole: actor?.role,
        targetUserId: userId,
        meta: { changedKeys: Object.keys(patch ?? {}) }
      });
      this.ui.success(this.buildUpdateSuccessMessage(patch));
      if (syncWarning) this.ui.warn(syncWarning);
    } catch (error: unknown) {
      void this.audit.log({
        action: 'user.update',
        resource: 'user',
        resourceId: userId,
        status: 'error',
        actorId: actor?.uid,
        actorRole: actor?.role,
        targetUserId: userId,
        meta: { changedKeys: Object.keys(patch ?? {}) }
      });
      this.ui.error(this.getErrorMessage(error, 'Errore aggiornamento utente'));
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const actor = this.auth.userSig();
    try {
      this.assertAdminAction();
      const confirmed = await this.confirmAction.confirm({
        title: 'Conferma rimozione utente',
        message: 'Vuoi nascondere questo utente?',
        confirmText: 'Conferma',
        cancelText: 'Annulla',
      });
      if (!confirmed) return;
      if (actor?.uid === userId) {
        throw new Error('Non puoi nascondere il tuo account');
      }

      const userRef = ref(this.db, `users/${userId}`);
      const currentSnap = await getDb(userRef);
      const current = (currentSnap.val() ?? {}) as Record<string, unknown>;
      const currentRole = String(current['role'] ?? '');
      if (currentRole === 'admin') {
        const adminCount = await this.getVisibleAdminCount();
        if (adminCount <= 1) {
          throw new Error('Impossibile nascondere l ultimo admin');
        }
      }

      const hidePatch: Record<string, unknown> = {
        isVisible: false,
        isActive: false,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await updateDb(userRef, hidePatch);
      void this.audit.log({
        action: 'user.hide',
        resource: 'user',
        resourceId: userId,
        status: 'success',
        actorId: actor?.uid,
        actorRole: actor?.role,
        targetUserId: userId
      });
      this.ui.warn('Utente nascosto');
    } catch (error: unknown) {
      void this.audit.log({
        action: 'user.hide',
        resource: 'user',
        resourceId: userId,
        status: 'error',
        actorId: actor?.uid,
        actorRole: actor?.role,
        targetUserId: userId
      });
      this.ui.error(this.getErrorMessage(error, 'Errore eliminazione utente'));
      throw error;
    }
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    const maybeMessage = (error as { message?: unknown } | null)?.message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;
    return fallback;
  }
}


