import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { AuthService } from '../../../../core/services/auth/authservice';
import {
  BonusService,
  UserWallet,
  WalletLedgerEntry
} from '../../../../core/services/bonus/bonus.service';
import { MaterialModule } from '../../../../core/modules/material.module';
import { LanguageService } from '../../../../core/services/language/language.service';

@Component({
  selector: 'app-promo-referral',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './promo-referral.component.html',
  styleUrls: ['./promo-referral.component.scss']
})
export class PromoReferralComponent implements OnInit {
  private fb = inject(FormBuilder);

  promoForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(3)]]
  });

  giftForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(3)]]
  });

  wallet$: Observable<UserWallet> = of({ userId: '', balance: 0, updatedAt: new Date(0).toISOString() });
  ledger$: Observable<WalletLedgerEntry[]> = of([]);

  applyingPromo = false;
  redeemingGift = false;

  constructor(
    private auth: AuthService,
    private bonusService: BonusService,
    public lang: LanguageService
  ) {}

  async ngOnInit(): Promise<void> {
    const user = await this.auth.resolveCurrentUser();
    if (!user) return;

    this.wallet$ = this.bonusService.streamWallet(user.uid);
    this.ledger$ = this.bonusService.streamWalletLedger(user.uid);
  }

  async applyPromo(): Promise<void> {
    if (this.promoForm.invalid || this.applyingPromo) return;

    this.applyingPromo = true;
    try {
      await this.bonusService.applyPromoCodeForCurrentUser(this.promoForm.value.code || '');
      this.promoForm.reset();
    } catch (error) {
      console.error('[PromoReferralComponent] applyPromo error', error);
    } finally {
      this.applyingPromo = false;
    }
  }

  async redeemGiftCard(): Promise<void> {
    if (this.giftForm.invalid || this.redeemingGift) return;

    this.redeemingGift = true;
    try {
      await this.bonusService.redeemGiftCardForCurrentUser(this.giftForm.value.code || '');
      this.giftForm.reset();
    } catch (error) {
      console.error('[PromoReferralComponent] redeemGiftCard error', error);
    } finally {
      this.redeemingGift = false;
    }
  }

  trackLedger(_index: number, row: WalletLedgerEntry): string {
    return row.id;
  }

  ledgerTypeLabel(type: WalletLedgerEntry['type']): string {
    if (type === 'promo') return this.lang.t('bonus.client.ledger.typePromo');
    if (type === 'gift_card') return this.lang.t('bonus.client.ledger.typeGift');
    return this.lang.t('bonus.client.ledger.typeAdjustment');
  }
}
