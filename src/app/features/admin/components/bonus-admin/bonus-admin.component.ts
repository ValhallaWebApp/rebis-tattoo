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
import { DynamicField, DynamicFormComponent } from '../../../../shared/components/form/dynamic-form/dynamic-form.component';

@Component({
  selector: 'app-bonus-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, DynamicFormComponent],
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

  get promoFields(): DynamicField[] {
    return [
      {
        type: 'text',
        name: 'code',
        label: this.lang.t('bonus.admin.promoForm.codeLabel'),
        placeholder: this.lang.t('bonus.admin.promoForm.codePlaceholder')
      },
      {
        type: 'number',
        name: 'creditAmount',
        label: this.lang.t('bonus.admin.promoForm.creditLabel'),
        min: 1,
        required: true
      },
      {
        type: 'number',
        name: 'maxUses',
        label: this.lang.t('bonus.admin.promoForm.maxUsesLabel'),
        min: 1
      },
      {
        type: 'date-native',
        name: 'expiresAt',
        label: this.lang.t('bonus.admin.promoForm.expiryLabel')
      },
      {
        type: 'textarea',
        name: 'description',
        label: this.lang.t('bonus.admin.promoForm.descriptionLabel'),
        rows: 2,
        className: 'full'
      }
    ];
  }

  get giftFields(): DynamicField[] {
    return [
      {
        type: 'text',
        name: 'code',
        label: this.lang.t('bonus.admin.giftForm.codeLabel'),
        placeholder: this.lang.t('bonus.admin.giftForm.codePlaceholder')
      },
      {
        type: 'number',
        name: 'amount',
        label: this.lang.t('bonus.admin.giftForm.amountLabel'),
        min: 1,
        required: true
      },
      {
        type: 'date-native',
        name: 'expiresAt',
        label: this.lang.t('bonus.admin.giftForm.expiryLabel')
      },
      {
        type: 'textarea',
        name: 'note',
        label: this.lang.t('bonus.admin.giftForm.noteLabel'),
        rows: 2,
        className: 'full'
      }
    ];
  }

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
