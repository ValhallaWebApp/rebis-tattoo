import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, combineLatest, map, of, startWith } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../../core/services/auth/auth.service';
import {
  BonusService,
  UserWallet,
  WalletLedgerEntry
} from '../../../../core/services/bonus/bonus.service';
import { MaterialModule } from '../../../../core/modules/material.module';
import { LanguageService } from '../../../../core/services/language/language.service';
import { DynamicField, DynamicFormComponent } from '../../../../shared/components/form/dynamic-form/dynamic-form.component';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';
import { User, UserService } from '../../../../core/services/users/user.service';
import {
  PaymentCollectionDialogComponent,
  PaymentCollectionDialogData,
  PaymentCollectionDialogResult
} from '../../../../shared/components/dialogs/payment-collection-dialog/payment-collection-dialog.component';

@Component({
  selector: 'app-promo-referral',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, DynamicFormComponent],
  templateUrl: './promo-referral.component.html',
  styleUrls: ['./promo-referral.component.scss']
})
export class PromoReferralComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);

  giftForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(3)]]
  });
  giftFields: DynamicField[] = [];
  buyGiftForm = this.fb.group({
    name: ['Gift Card Cliente', [Validators.required, Validators.minLength(3)]],
    amount: [50, [Validators.required, Validators.min(1)]],
    note: [''],
    isGift: [false],
    giftedRecipientSearch: [''],
    giftedToUserId: [''],
    giftedToName: [''],
    giftedToEmail: [''],
    giftedToPhone: [''],
    giftMessage: ['']
  });
  readonly suggestedAmounts = [50, 100, 150, 200];

  wallet$: Observable<UserWallet> = of({ userId: '', balance: 0, updatedAt: new Date(0).toISOString() });
  ledger$: Observable<WalletLedgerEntry[]> = of([]);
  giftLedger$: Observable<WalletLedgerEntry[]> = of([]);
  recipientUsers$: Observable<User[]> = of([]);
  filteredRecipientUsers$: Observable<User[]> = of([]);

  redeemingGift = false;
  buyingGift = false;
  finalizingGiftPurchase = false;

  constructor(
    private auth: AuthService,
    private bonusService: BonusService,
    private userService: UserService,
    private ui: UiFeedbackService,
    public lang: LanguageService
  ) {}

  async ngOnInit(): Promise<void> {
    this.giftFields = [
      {
        type: 'text',
        name: 'code',
        label: this.lang.t('bonus.client.gift.codeLabel'),
        placeholder: this.lang.t('bonus.client.gift.placeholder')
      }
    ];

    const user = await this.auth.resolveCurrentUser();
    if (!user) return;

    this.wallet$ = this.bonusService.streamWallet(user.uid);
    this.ledger$ = this.bonusService.streamWalletLedger(user.uid);
    this.giftLedger$ = this.ledger$.pipe(
      map((rows) => (rows ?? []).filter((row) => this.isGiftLedgerRow(row)))
    );
    this.recipientUsers$ = this.userService.getAllUsers().pipe(
      map((users) => (users ?? []).filter((u) => u.id !== user.uid))
    );
    this.filteredRecipientUsers$ = combineLatest([
      this.recipientUsers$,
      this.buyGiftForm.controls.giftedRecipientSearch.valueChanges.pipe(startWith(''))
    ]).pipe(
      map(([users, searchRaw]) => {
        const search = this.recipientLabel(typeof searchRaw === 'string' ? searchRaw : searchRaw ?? null).toLowerCase().trim();
        if (!search) return users;
        return users.filter((u) => this.recipientLabel(u).toLowerCase().includes(search));
      })
    );
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

  setSuggestedAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.buyGiftForm.patchValue({ amount });
  }

  async buyGiftCard(): Promise<void> {
    if (this.buyGiftForm.invalid || this.buyingGift) return;

    const user = await this.auth.resolveCurrentUser();
    if (!user) {
      this.ui.error('Devi essere autenticato per comprare una gift card.');
      return;
    }

    const amount = Number(this.buyGiftForm.value.amount ?? 0);
    const name = String(this.buyGiftForm.value.name ?? '').trim();
    const note = String(this.buyGiftForm.value.note ?? '').trim();
    const isGift = this.buyGiftForm.value.isGift === true;
    const giftedRecipientSearch = this.buyGiftForm.value.giftedRecipientSearch;
    const giftedToUserId = String(this.buyGiftForm.value.giftedToUserId ?? '').trim();
    const giftedToName = String(this.buyGiftForm.value.giftedToName ?? '').trim();
    const giftedToEmail = String(this.buyGiftForm.value.giftedToEmail ?? '').trim();
    const giftedToPhone = String(this.buyGiftForm.value.giftedToPhone ?? '').trim();
    const giftMessage = String(this.buyGiftForm.value.giftMessage ?? '').trim();
    if (!name || !Number.isFinite(amount) || amount <= 0) return;

    this.buyingGift = true;
    try {
      const paidAmount = await this.openCollectPaymentDialog({
        title: 'Compra Gift Card',
        subtitle: `Intestazione: ${name}`,
        defaultAmountEuro: amount,
        bookingId: `gift-buy:${user.uid}:${Date.now()}`,
        description: `Acquisto gift card cliente (${name})`,
        referenceType: 'gift_card',
        referenceId: '',
        referenceLabel: name
      });

      if (paidAmount == null) return;

      this.finalizingGiftPurchase = true;
      try {
        const createdGift = await this.bonusService.createGiftCardFromPurchase({
          name,
          amount: paidAmount,
          note: note || undefined,
          buyerUserId: user.uid,
          source: 'client_purchase',
          giftedToUserId: isGift ? (giftedToUserId || undefined) : undefined,
          giftedToName: isGift ? (giftedToName || undefined) : undefined,
          giftedToEmail: isGift ? (giftedToEmail || undefined) : undefined,
          giftedToPhone: isGift ? (giftedToPhone || undefined) : undefined,
          giftMessage: isGift ? (giftMessage || undefined) : undefined
        });

        console.log('[ClientBonus] gift card purchase + creation completed', {
          buyerUserId: user.uid,
          giftId: createdGift.giftId,
          giftCode: createdGift.code,
          giftCardName: name,
          amountEuro: createdGift.amount,
          note,
          isGift,
          giftedRecipientSearch,
          giftedToName,
          giftedToEmail,
          giftedToPhone
        });

        this.ui.success(`Pagamento completato. Gift card creata: ${createdGift.code}.`);
      } catch (creationError) {
        console.error('[PromoReferralComponent] createGiftCardFromPurchase error', creationError);
        this.ui.success('Pagamento completato. Lo studio generera il codice reale della gift card.');
      } finally {
        this.finalizingGiftPurchase = false;
      }
      this.buyGiftForm.patchValue({
        note: '',
        isGift: false,
        giftedRecipientSearch: '',
        giftedToUserId: '',
        giftedToName: '',
        giftedToEmail: '',
        giftedToPhone: '',
        giftMessage: ''
      });
    } catch (error) {
      console.error('[PromoReferralComponent] buyGiftCard error', error);
      this.ui.error('Pagamento non riuscito.');
    } finally {
      this.buyingGift = false;
    }
  }

  trackLedger(_index: number, row: WalletLedgerEntry): string {
    return row.id;
  }

  isGiftLedgerRow(row: WalletLedgerEntry): boolean {
    return String(row?.type ?? '').toLowerCase() === 'gift_card';
  }

  ledgerTypeLabel(type: WalletLedgerEntry['type']): string {
    if (type === 'gift_card') return this.lang.t('bonus.client.ledger.typeGift');
    return 'Credito';
  }

  onGiftRecipientSelected(user: User | null): void {
    if (!user) return;
    const safeUserId = String(user.id ?? '').trim();
    if (!safeUserId) return;
    this.buyGiftForm.patchValue({
      giftedRecipientSearch: this.recipientLabel(user),
      giftedToUserId: safeUserId,
      giftedToName: String(user.name ?? '').trim(),
      giftedToEmail: String(user.email ?? '').trim(),
      giftedToPhone: String(user.phone ?? '').trim()
    });
  }

  recipientLabel(value: User | string | null): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    const name = String(value.name ?? '').trim();
    const email = String(value.email ?? '').trim();
    if (name && email) return `${name} (${email})`;
    return name || email || String(value.id ?? '').trim();
  }

  onGiftRecipientSearchInput(rawValue: string): void {
    const value = String(rawValue ?? '').trim();
    if (value) return;
    this.buyGiftForm.patchValue({
      giftedToUserId: '',
      giftedToName: '',
      giftedToEmail: '',
      giftedToPhone: ''
    });
  }

  private async openCollectPaymentDialog(data: PaymentCollectionDialogData): Promise<number | null> {
    const ref = this.dialog.open(PaymentCollectionDialogComponent, {
      width: '640px',
      maxWidth: '96vw',
      data
    });
    const result = await ref.afterClosed().toPromise() as PaymentCollectionDialogResult | undefined;
    if (!result?.ok) return null;
    const amount = Number(result.amountEuro ?? 0);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }
}


