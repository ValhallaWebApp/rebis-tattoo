import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import {
  BonusService,
  GiftCard,
  PromoCode
} from '../../../../core/services/bonus/bonus.service';
import { MaterialModule } from '../../../../core/modules/material.module';
import { LanguageService } from '../../../../core/services/language/language.service';

@Component({
  selector: 'app-bonus-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './bonus-admin.component.html',
  styleUrl: './bonus-admin.component.scss'
})
export class BonusAdminComponent {
  private fb = inject(FormBuilder);

  readonly promoCodes$: Observable<PromoCode[]>;
  readonly giftCards$: Observable<GiftCard[]>;

  promoForm = this.fb.group({
    code: [''],
    creditAmount: [10, [Validators.required, Validators.min(1)]],
    maxUses: [null as number | null],
    expiresAt: [''],
    description: ['']
  });

  giftForm = this.fb.group({
    code: [''],
    amount: [50, [Validators.required, Validators.min(1)]],
    expiresAt: [''],
    note: ['']
  });

  savingPromo = false;
  savingGift = false;

  constructor(
    private bonusService: BonusService,
    public lang: LanguageService
  ) {
    this.promoCodes$ = this.bonusService.streamPromoCodes();
    this.giftCards$ = this.bonusService.streamGiftCards();
  }

  async createPromo(): Promise<void> {
    if (this.promoForm.invalid || this.savingPromo) return;

    this.savingPromo = true;
    try {
      await this.bonusService.createPromoCode({
        code: this.promoForm.value.code || undefined,
        creditAmount: Number(this.promoForm.value.creditAmount),
        maxUses: this.promoForm.value.maxUses ? Number(this.promoForm.value.maxUses) : null,
        expiresAt: this.promoForm.value.expiresAt || null,
        description: this.promoForm.value.description || undefined
      });

      this.promoForm.reset({
        code: '',
        creditAmount: 10,
        maxUses: null,
        expiresAt: '',
        description: ''
      });
    } catch (error) {
      console.error('[BonusAdminComponent] createPromo error', error);
    } finally {
      this.savingPromo = false;
    }
  }

  async createGiftCard(): Promise<void> {
    if (this.giftForm.invalid || this.savingGift) return;

    this.savingGift = true;
    try {
      await this.bonusService.createGiftCard({
        code: this.giftForm.value.code || undefined,
        amount: Number(this.giftForm.value.amount),
        expiresAt: this.giftForm.value.expiresAt || null,
        note: this.giftForm.value.note || undefined
      });

      this.giftForm.reset({
        code: '',
        amount: 50,
        expiresAt: '',
        note: ''
      });
    } catch (error) {
      console.error('[BonusAdminComponent] createGiftCard error', error);
    } finally {
      this.savingGift = false;
    }
  }

  async togglePromo(item: PromoCode): Promise<void> {
    try {
      await this.bonusService.setPromoActive(item.id, !item.active);
    } catch (error) {
      console.error('[BonusAdminComponent] togglePromo error', error);
    }
  }

  async toggleGift(item: GiftCard): Promise<void> {
    try {
      await this.bonusService.setGiftCardActive(item.id, !item.active);
    } catch (error) {
      console.error('[BonusAdminComponent] toggleGift error', error);
    }
  }

  trackPromo(_index: number, item: PromoCode): string {
    return item.id;
  }

  trackGift(_index: number, item: GiftCard): string {
    return item.id;
  }

  promoUsageLabel(item: PromoCode): string {
    const maxPart = item.maxUses !== null ? `/${item.maxUses}` : '';
    return `${this.lang.t('bonus.admin.list.usagePrefix')} ${item.usedCount}${maxPart}`;
  }
}
