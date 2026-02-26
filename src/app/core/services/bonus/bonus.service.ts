import { Injectable } from '@angular/core';
import {
  Database,
  equalTo,
  get,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  set,
  update
} from '@angular/fire/database';
import { Auth } from '@angular/fire/auth';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthService } from '../auth/auth.service';
import { LanguageService } from '../language/language.service';
import { UiFeedbackService } from '../ui/ui-feedback.service';
import { environment } from '../../../../environment';
import { mapHttpError } from '../../http/http-error.mapper';
import { withCriticalHttpPolicy } from '../../http/http-policy';
import {
  BonusRedeemRequestDto,
  BonusRedeemResponseDto
} from '../../models/api/payment-bridge.dto';

export interface PromoCode {
  id: string;
  code: string;
  creditAmount: number;
  description?: string;
  active: boolean;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface GiftCard {
  id: string;
  code: string;
  initialAmount: number;
  balance: number;
  note?: string;
  active: boolean;
  redeemedBy?: string | null;
  redeemedAt?: string | null;
  usesCount: number;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface UserWallet {
  userId: string;
  balance: number;
  updatedAt: string;
}

export interface WalletLedgerEntry {
  id: string;
  userId: string;
  type: 'promo' | 'gift_card' | 'adjustment';
  code: string;
  amount: number;
  sourceId: string;
  at: string;
  note?: string;
}

@Injectable({ providedIn: 'root' })
export class BonusService {
  private readonly path = 'bonus';
  private readonly paymentApiBaseUrl = environment.paymentApiBaseUrl.replace(/\/+$/, '');

  constructor(
    private db: Database,
    private auth: AuthService,
    private ui: UiFeedbackService,
    private audit: AuditLogService,
    private lang: LanguageService,
    private http: HttpClient,
    private firebaseAuth: Auth
  ) {}

  streamPromoCodes(): Observable<PromoCode[]> {
    return new Observable<PromoCode[]>(observer => {
      const node = ref(this.db, `${this.path}/promoCodes`);
      const unsub = onValue(
        node,
        snap => {
          if (!snap.exists()) {
            observer.next([]);
            return;
          }

          const raw = snap.val() as Record<string, Partial<PromoCode>>;
          const list = Object.entries(raw)
            .map(([id, item]) => this.toPromo(id, item))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

          observer.next(list);
        },
        error => observer.error(error)
      );

      return () => unsub();
    });
  }

  streamGiftCards(): Observable<GiftCard[]> {
    return new Observable<GiftCard[]>(observer => {
      const node = ref(this.db, `${this.path}/giftCards`);
      const unsub = onValue(
        node,
        snap => {
          if (!snap.exists()) {
            observer.next([]);
            return;
          }

          const raw = snap.val() as Record<string, Partial<GiftCard>>;
          const list = Object.entries(raw)
            .map(([id, item]) => this.toGiftCard(id, item))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

          observer.next(list);
        },
        error => observer.error(error)
      );

      return () => unsub();
    });
  }

  streamWallet(userId: string): Observable<UserWallet> {
    if (!userId) {
      return of({ userId: '', balance: 0, updatedAt: new Date(0).toISOString() });
    }

    return new Observable<UserWallet>(observer => {
      const node = ref(this.db, `${this.path}/wallets/${userId}`);
      const unsub = onValue(
        node,
        snap => {
          if (!snap.exists()) {
            observer.next({ userId, balance: 0, updatedAt: new Date(0).toISOString() });
            return;
          }
          observer.next(this.toWallet(userId, snap.val() as Partial<UserWallet>));
        },
        error => observer.error(error)
      );

      return () => unsub();
    });
  }

  streamWalletLedger(userId: string, limit = 50): Observable<WalletLedgerEntry[]> {
    if (!userId) return of([]);

    return new Observable<WalletLedgerEntry[]>(observer => {
      const node = ref(this.db, `${this.path}/ledger/${userId}`);
      const unsub = onValue(
        node,
        snap => {
          if (!snap.exists()) {
            observer.next([]);
            return;
          }

          const raw = snap.val() as Record<string, Partial<WalletLedgerEntry>>;
          const list = Object.entries(raw)
            .map(([id, item]) => this.toLedger(id, userId, item))
            .sort((a, b) => b.at.localeCompare(a.at))
            .slice(0, limit);

          observer.next(list);
        },
        error => observer.error(error)
      );

      return () => unsub();
    });
  }

  async createPromoCode(input: {
    code?: string;
    creditAmount: number;
    maxUses?: number | null;
    expiresAt?: string | null;
    description?: string;
  }): Promise<PromoCode> {
    const actor = await this.requireManager();
    const now = new Date().toISOString();

    const amount = Number(input.creditAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(this.t('bonus.service.errors.invalidPromoAmount'));
    }

    const code = this.normalizeCode(input.code || this.randomCode('PROMO'));
    await this.ensureCodeNotUsed('promoCodes', code);

    const node = push(ref(this.db, `${this.path}/promoCodes`));
    const id = node.key ?? `${Date.now()}`;

    const promo: PromoCode = {
      id,
      code,
      creditAmount: Math.round(amount * 100) / 100,
      description: input.description?.trim() || undefined,
      active: true,
      maxUses: input.maxUses && input.maxUses > 0 ? Math.floor(input.maxUses) : null,
      usedCount: 0,
      expiresAt: this.normalizeDate(input.expiresAt),
      createdAt: now,
      updatedAt: now,
      createdBy: actor.uid
    };

    try {
      await set(node, this.stripUndef(promo));
      this.ui.success(this.t('bonus.service.feedback.promoCreated', { code: promo.code }));
      void this.audit.log({
        action: 'bonus.promo.create',
        resource: 'bonus_promo',
        resourceId: promo.id,
        actorId: actor.uid,
        actorRole: actor.role,
        status: 'success',
        meta: { code: promo.code, creditAmount: promo.creditAmount }
      });
      return promo;
    } catch (error: any) {
      void this.audit.log({
        action: 'bonus.promo.create',
        resource: 'bonus_promo',
        resourceId: id,
        actorId: actor.uid,
        actorRole: actor.role,
        status: 'error',
        message: String(error?.message ?? error)
      });
      this.ui.error(this.t('bonus.service.feedback.promoCreateError'));
      throw error;
    }
  }

  async setPromoActive(promoId: string, active: boolean): Promise<void> {
    const actor = await this.requireManager();

    try {
      await update(ref(this.db, `${this.path}/promoCodes/${promoId}`), {
        active,
        updatedAt: new Date().toISOString()
      });
      this.ui.info(active ? this.t('bonus.service.feedback.promoEnabled') : this.t('bonus.service.feedback.promoDisabled'));
      void this.audit.log({
        action: 'bonus.promo.toggle',
        resource: 'bonus_promo',
        resourceId: promoId,
        actorId: actor.uid,
        actorRole: actor.role,
        status: 'success',
        meta: { active }
      });
    } catch (error: any) {
      void this.audit.log({
        action: 'bonus.promo.toggle',
        resource: 'bonus_promo',
        resourceId: promoId,
        actorId: actor.uid,
        actorRole: actor.role,
        status: 'error',
        message: String(error?.message ?? error),
        meta: { active }
      });
      this.ui.error(this.t('bonus.service.feedback.promoUpdateError'));
      throw error;
    }
  }

  async createGiftCard(input: {
    code?: string;
    amount: number;
    expiresAt?: string | null;
    note?: string;
  }): Promise<GiftCard> {
    const actor = await this.requireManager();
    const now = new Date().toISOString();

    const amount = Number(input.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(this.t('bonus.service.errors.invalidGiftAmount'));
    }

    const code = this.normalizeCode(input.code || this.randomCode('GIFT'));
    await this.ensureCodeNotUsed('giftCards', code);

    const node = push(ref(this.db, `${this.path}/giftCards`));
    const id = node.key ?? `${Date.now()}`;

    const gift: GiftCard = {
      id,
      code,
      initialAmount: Math.round(amount * 100) / 100,
      balance: Math.round(amount * 100) / 100,
      note: input.note?.trim() || undefined,
      active: true,
      redeemedBy: null,
      redeemedAt: null,
      usesCount: 0,
      expiresAt: this.normalizeDate(input.expiresAt),
      createdAt: now,
      updatedAt: now,
      createdBy: actor.uid
    };

    try {
      await set(node, this.stripUndef(gift));
      this.ui.success(this.t('bonus.service.feedback.giftCreated', { code: gift.code }));
      void this.audit.log({
        action: 'bonus.gift.create',
        resource: 'gift_card',
        resourceId: gift.id,
        actorId: actor.uid,
        actorRole: actor.role,
        status: 'success',
        meta: { code: gift.code, amount: gift.initialAmount }
      });
      return gift;
    } catch (error: any) {
      void this.audit.log({
        action: 'bonus.gift.create',
        resource: 'gift_card',
        resourceId: id,
        actorId: actor.uid,
        actorRole: actor.role,
        status: 'error',
        message: String(error?.message ?? error)
      });
      this.ui.error(this.t('bonus.service.feedback.giftCreateError'));
      throw error;
    }
  }

  async setGiftCardActive(giftId: string, active: boolean): Promise<void> {
    const actor = await this.requireManager();

    try {
      await update(ref(this.db, `${this.path}/giftCards/${giftId}`), {
        active,
        updatedAt: new Date().toISOString()
      });
      this.ui.info(active ? this.t('bonus.service.feedback.giftEnabled') : this.t('bonus.service.feedback.giftDisabled'));
      void this.audit.log({
        action: 'bonus.gift.toggle',
        resource: 'gift_card',
        resourceId: giftId,
        actorId: actor.uid,
        actorRole: actor.role,
        status: 'success',
        meta: { active }
      });
    } catch (error: any) {
      void this.audit.log({
        action: 'bonus.gift.toggle',
        resource: 'gift_card',
        resourceId: giftId,
        actorId: actor.uid,
        actorRole: actor.role,
        status: 'error',
        message: String(error?.message ?? error),
        meta: { active }
      });
      this.ui.error(this.t('bonus.service.feedback.giftUpdateError'));
      throw error;
    }
  }

  async applyPromoCodeForCurrentUser(rawCode: string): Promise<{ code: string; amount: number; walletBalance: number }> {
    await this.requireLogged();
    const code = this.normalizeCode(rawCode);
    if (!code) throw new Error(this.t('bonus.service.errors.enterPromoCode'));
    try {
      const result = await this.applyPromoCodeViaBackend(code);
      this.ui.success(this.t('bonus.service.feedback.promoApplied', { amount: result.amount.toFixed(2) }));
      return result;
    } catch (error: unknown) {
      const message = this.mapBonusBackendErrorToMessage(error, 'promo');
      this.ui.error(message);
      throw new Error(message);
    }
  }

  async redeemGiftCardForCurrentUser(rawCode: string): Promise<{ code: string; amount: number; walletBalance: number }> {
    await this.requireLogged();
    const code = this.normalizeCode(rawCode);
    if (!code) throw new Error(this.t('bonus.service.errors.enterGiftCode'));
    try {
      const result = await this.redeemGiftCardViaBackend(code);
      this.ui.success(this.t('bonus.service.feedback.giftRedeemed', { amount: result.amount.toFixed(2) }));
      return result;
    } catch (error: unknown) {
      const message = this.mapBonusBackendErrorToMessage(error, 'gift');
      this.ui.error(message);
      throw new Error(message);
    }
  }

  private async getBackendAuthHeaders(): Promise<HttpHeaders> {
    const token = await this.firebaseAuth.currentUser?.getIdToken();
    if (!token) throw new Error(this.t('bonus.service.errors.notAuthenticated'));

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private async applyPromoCodeViaBackend(code: string): Promise<{ code: string; amount: number; walletBalance: number }> {
    const headers = await this.getBackendAuthHeaders();
    const request: BonusRedeemRequestDto = { code };

    let response: BonusRedeemResponseDto;
    try {
      response = await firstValueFrom(
        this.http.post<BonusRedeemResponseDto>(
          `${this.paymentApiBaseUrl}/bonus/apply-promo`,
          request,
          { headers }
        ).pipe(withCriticalHttpPolicy())
      );
    } catch (error) {
      const mapped = mapHttpError(error, {
        fallbackMessage: this.t('bonus.service.feedback.promoApplyError'),
        timeoutMessage: this.t('bonus.service.feedback.promoApplyError'),
        networkMessage: this.t('bonus.service.feedback.promoApplyError'),
        unauthorizedMessage: this.t('bonus.service.errors.notAuthenticated')
      });
      throw new Error(mapped.message);
    }

    if (!response?.success) {
      throw new Error(this.t('bonus.service.feedback.promoApplyError'));
    }

    return {
      code: this.normalizeCode(response.code),
      amount: this.roundMoney(response.amount),
      walletBalance: this.roundMoney(response.walletBalance)
    };
  }

  private async redeemGiftCardViaBackend(code: string): Promise<{ code: string; amount: number; walletBalance: number }> {
    const headers = await this.getBackendAuthHeaders();
    const request: BonusRedeemRequestDto = { code };

    let response: BonusRedeemResponseDto;
    try {
      response = await firstValueFrom(
        this.http.post<BonusRedeemResponseDto>(
          `${this.paymentApiBaseUrl}/bonus/redeem-gift`,
          request,
          { headers }
        ).pipe(withCriticalHttpPolicy())
      );
    } catch (error) {
      const mapped = mapHttpError(error, {
        fallbackMessage: this.t('bonus.service.feedback.giftRedeemError'),
        timeoutMessage: this.t('bonus.service.feedback.giftRedeemError'),
        networkMessage: this.t('bonus.service.feedback.giftRedeemError'),
        unauthorizedMessage: this.t('bonus.service.errors.notAuthenticated')
      });
      throw new Error(mapped.message);
    }

    if (!response?.success) {
      throw new Error(this.t('bonus.service.feedback.giftRedeemError'));
    }

    return {
      code: this.normalizeCode(response.code),
      amount: this.roundMoney(response.amount),
      walletBalance: this.roundMoney(response.walletBalance)
    };
  }

  private mapBonusBackendErrorToMessage(error: unknown, kind: 'promo' | 'gift'): string {
    const payload = (error as { error?: unknown } | null)?.error as Record<string, unknown> | string | undefined;
    const code = typeof payload === 'string'
      ? payload
      : String(payload?.['error'] ?? payload?.['message'] ?? (error as { message?: unknown } | null)?.message ?? '')
        .trim()
        .toUpperCase();

    if (kind === 'promo') {
      if (code.includes('ENTER_PROMO_CODE')) return this.t('bonus.service.errors.enterPromoCode');
      if (code.includes('PROMO_NOT_FOUND')) return this.t('bonus.service.errors.promoNotFound');
      if (code.includes('PROMO_ALREADY_USED')) return this.t('bonus.service.errors.promoAlreadyUsed');
      if (code.includes('PROMO_DISABLED')) return this.t('bonus.service.errors.promoDisabled');
      if (code.includes('PROMO_EXPIRED')) return this.t('bonus.service.errors.promoExpired');
      if (code.includes('PROMO_EXHAUSTED')) return this.t('bonus.service.errors.promoExhausted');
      if (code.includes('NOT_AUTH') || code.includes('AUTH_FAILED') || code.includes('MISSING-AUTH-TOKEN')) {
        return this.t('bonus.service.errors.notAuthenticated');
      }
      return this.t('bonus.service.feedback.promoApplyError');
    }

    if (code.includes('ENTER_GIFT_CODE')) return this.t('bonus.service.errors.enterGiftCode');
    if (code.includes('GIFT_NOT_FOUND')) return this.t('bonus.service.errors.giftNotFound');
    if (code.includes('GIFT_ALREADY_REDEEMED')) return this.t('bonus.service.errors.giftAlreadyRedeemed');
    if (code.includes('GIFT_DISABLED')) return this.t('bonus.service.errors.giftDisabled');
    if (code.includes('GIFT_EXPIRED')) return this.t('bonus.service.errors.giftExpired');
    if (code.includes('NOT_AUTH') || code.includes('AUTH_FAILED') || code.includes('MISSING-AUTH-TOKEN')) {
      return this.t('bonus.service.errors.notAuthenticated');
    }
    return this.t('bonus.service.feedback.giftRedeemError');
  }

  private async requireLogged(): Promise<{ uid: string; role: string }> {
    const user = await this.auth.resolveCurrentUser();
    if (!user) throw new Error(this.t('bonus.service.errors.notAuthenticated'));
    return { uid: user.uid, role: user.role };
  }

  private async requireManager(): Promise<{ uid: string; role: string }> {
    const user = await this.auth.resolveCurrentUser();
    if (!user) throw new Error(this.t('bonus.service.errors.notAuthenticated'));
    if (user.role !== 'admin' && user.role !== 'staff') {
      throw new Error(this.t('bonus.service.errors.onlyManager'));
    }
    return { uid: user.uid, role: user.role };
  }

  private async ensureCodeNotUsed(collectionName: 'promoCodes' | 'giftCards', code: string): Promise<void> {
    const q = query(ref(this.db, `${this.path}/${collectionName}`), orderByChild('code'), equalTo(code));
    const snap = await get(q);
    if (snap.exists()) throw new Error(this.t('bonus.service.errors.codeAlreadyExists', { code }));
  }

  private async findPromoByCode(code: string): Promise<PromoCode | null> {
    const q = query(ref(this.db, `${this.path}/promoCodes`), orderByChild('code'), equalTo(code));
    const snap = await get(q);
    if (!snap.exists()) return null;

    const [id, value] = Object.entries(snap.val() as Record<string, Partial<PromoCode>>)[0];
    return this.toPromo(id, value);
  }

  private async findGiftCardByCode(code: string): Promise<GiftCard | null> {
    const q = query(ref(this.db, `${this.path}/giftCards`), orderByChild('code'), equalTo(code));
    const snap = await get(q);
    if (!snap.exists()) return null;

    const [id, value] = Object.entries(snap.val() as Record<string, Partial<GiftCard>>)[0];
    return this.toGiftCard(id, value);
  }

  private assertPromoAvailable(promo: PromoCode): void {
    if (!promo.active) throw new Error(this.t('bonus.service.errors.promoDisabled'));
    if (promo.expiresAt && promo.expiresAt < new Date().toISOString()) {
      throw new Error(this.t('bonus.service.errors.promoExpired'));
    }
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      throw new Error(this.t('bonus.service.errors.promoExhausted'));
    }
  }

  private assertGiftCardAvailable(gift: GiftCard): void {
    if (!gift.active) throw new Error(this.t('bonus.service.errors.giftDisabled'));
    if (gift.expiresAt && gift.expiresAt < new Date().toISOString()) {
      throw new Error(this.t('bonus.service.errors.giftExpired'));
    }
  }

  private async readWallet(userId: string): Promise<UserWallet> {
    const snap = await get(ref(this.db, `${this.path}/wallets/${userId}`));
    if (!snap.exists()) {
      return { userId, balance: 0, updatedAt: new Date(0).toISOString() };
    }
    return this.toWallet(userId, snap.val() as Partial<UserWallet>);
  }

  private toPromo(id: string, item: Partial<PromoCode>): PromoCode {
    return {
      id,
      code: this.normalizeCode(item.code ?? ''),
      creditAmount: this.roundMoney(Number(item.creditAmount ?? 0)),
      description: item.description ? String(item.description) : undefined,
      active: item.active !== false,
      maxUses: item.maxUses === undefined || item.maxUses === null ? null : Number(item.maxUses),
      usedCount: Number(item.usedCount ?? 0),
      expiresAt: item.expiresAt ? String(item.expiresAt) : null,
      createdAt: String(item.createdAt ?? new Date(0).toISOString()),
      updatedAt: String(item.updatedAt ?? item.createdAt ?? new Date(0).toISOString()),
      createdBy: String(item.createdBy ?? 'system')
    };
  }

  private toGiftCard(id: string, item: Partial<GiftCard>): GiftCard {
    const initial = this.roundMoney(Number(item.initialAmount ?? item.balance ?? 0));
    const balance = this.roundMoney(Number(item.balance ?? initial));

    return {
      id,
      code: this.normalizeCode(item.code ?? ''),
      initialAmount: initial,
      balance,
      note: item.note ? String(item.note) : undefined,
      active: item.active !== false,
      redeemedBy: item.redeemedBy ? String(item.redeemedBy) : null,
      redeemedAt: item.redeemedAt ? String(item.redeemedAt) : null,
      usesCount: Number(item.usesCount ?? 0),
      expiresAt: item.expiresAt ? String(item.expiresAt) : null,
      createdAt: String(item.createdAt ?? new Date(0).toISOString()),
      updatedAt: String(item.updatedAt ?? item.createdAt ?? new Date(0).toISOString()),
      createdBy: String(item.createdBy ?? 'system')
    };
  }

  private toWallet(userId: string, item: Partial<UserWallet>): UserWallet {
    return {
      userId,
      balance: this.roundMoney(Number(item.balance ?? 0)),
      updatedAt: String(item.updatedAt ?? new Date(0).toISOString())
    };
  }

  private toLedger(id: string, userId: string, item: Partial<WalletLedgerEntry>): WalletLedgerEntry {
    return {
      id,
      userId,
      type: (item.type as WalletLedgerEntry['type']) ?? 'adjustment',
      code: String(item.code ?? ''),
      amount: this.roundMoney(Number(item.amount ?? 0)),
      sourceId: String(item.sourceId ?? ''),
      at: String(item.at ?? new Date(0).toISOString()),
      note: item.note ? String(item.note) : undefined
    };
  }

  private normalizeCode(value: string): string {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  private normalizeDate(value?: string | null): string | null {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  private randomCode(prefix: string): string {
    const base = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${prefix}-${base}`;
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private stripUndef<T extends object>(obj: T): Partial<T> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v !== undefined) out[k] = v;
    }
    return out as Partial<T>;
  }

  private t(path: string, params?: Record<string, string | number>): string {
    const base = this.lang.t(path);
    if (!params) return base;

    return Object.entries(params).reduce(
      (acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
      base
    );
  }
}


