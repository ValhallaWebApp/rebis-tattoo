import { CommonModule } from '@angular/common';
import { Component, TemplateRef, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, combineLatest, map, Observable, shareReplay } from 'rxjs';
import {
  BonusService,
  GiftCard
} from '../../../../core/services/bonus/bonus.service';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';
import { LanguageService } from '../../../../core/services/language/language.service';
import { DynamicField, DynamicFormComponent } from '../../../../shared/components/form/dynamic-form/dynamic-form.component';
import {
  PaymentCollectionDialogComponent,
  PaymentCollectionDialogData,
  PaymentCollectionDialogResult
} from '../../../../shared/components/dialogs/payment-collection-dialog/payment-collection-dialog.component';

@Component({
  selector: 'app-bonus-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, DynamicFormComponent],
  templateUrl: './bonus-admin.component.html',
  styleUrl: './bonus-admin.component.scss'
})
export class BonusAdminComponent {
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  @ViewChild('createGiftDialog') createGiftDialog?: TemplateRef<unknown>;
  private readonly assignmentFilter$ = new BehaviorSubject<'all' | 'assigned' | 'unassigned'>('all');
  private readonly activeFilter$ = new BehaviorSubject<'all' | 'active' | 'inactive'>('all');
  private readonly searchFilter$ = new BehaviorSubject<string>('');

  readonly giftCards$: Observable<GiftCard[]>;
  readonly filteredGiftCards$: Observable<GiftCard[]>;
  displayMode: 'table' | 'card' = 'table';
  assignmentFilter: 'all' | 'assigned' | 'unassigned' = 'all';
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  searchTerm = '';

  giftForm = this.fb.group({
    name: [''],
    amount: [50, [Validators.required, Validators.min(1)]],
    expiresAt: [''],
    note: ['']
  });

  savingGift = false;
  togglingGiftId: string | null = null;
  collectingGiftId: string | null = null;

  get giftFields(): DynamicField[] {
    return [
      {
        type: 'text',
        name: 'name',
        label: 'Nome Gift Card',
        placeholder: 'Es. Gift Natale 2026'
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
    this.giftCards$ = this.bonusService.streamGiftCards().pipe(shareReplay({ bufferSize: 1, refCount: true }));
    this.filteredGiftCards$ = combineLatest([
      this.giftCards$,
      this.assignmentFilter$,
      this.activeFilter$,
      this.searchFilter$
    ]).pipe(
      map(([cards, assignmentFilter, activeFilter, searchFilter]) => {
        const normalizedSearch = searchFilter.trim().toLowerCase();

        return (cards ?? []).filter((card) => {
          const isAssigned = this.isAssigned(card);
          const assignmentMatch =
            assignmentFilter === 'all' ||
            (assignmentFilter === 'assigned' && isAssigned) ||
            (assignmentFilter === 'unassigned' && !isAssigned);

          const activeMatch =
            activeFilter === 'all' ||
            (activeFilter === 'active' && card.active) ||
            (activeFilter === 'inactive' && !card.active);

          const searchMatch =
            !normalizedSearch ||
            card.code.toLowerCase().includes(normalizedSearch) ||
            String(card.redeemedBy ?? '').toLowerCase().includes(normalizedSearch) ||
            String(card.giftedToName ?? '').toLowerCase().includes(normalizedSearch) ||
            String(card.createdBy ?? '').toLowerCase().includes(normalizedSearch) ||
            String(card.note ?? '').toLowerCase().includes(normalizedSearch);

          return assignmentMatch && activeMatch && searchMatch;
        });
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  openCreateGiftDialog(): void {
    if (!this.createGiftDialog) return;
    this.dialog.open(this.createGiftDialog, {
      width: '640px',
      maxWidth: '96vw',
      autoFocus: false
    });
  }

  setDisplayMode(mode: 'table' | 'card'): void {
    this.displayMode = mode;
  }

  setAssignmentFilter(value: 'all' | 'assigned' | 'unassigned'): void {
    this.assignmentFilter = value;
    this.assignmentFilter$.next(value);
  }

  setActiveFilter(value: 'all' | 'active' | 'inactive'): void {
    this.activeFilter = value;
    this.activeFilter$.next(value);
  }

  setSearchTerm(value: string): void {
    this.searchTerm = value;
    this.searchFilter$.next(value);
  }

  async toggleGiftActive(card: GiftCard): Promise<void> {
    if (this.togglingGiftId) return;
    this.togglingGiftId = card.id;
    try {
      await this.bonusService.setGiftCardActive(card.id, !card.active);
    } catch (error) {
      console.error('[BonusAdminComponent] toggleGiftActive error', error);
    } finally {
      this.togglingGiftId = null;
    }
  }

  async collectGiftCardPayment(card: GiftCard): Promise<void> {
    if (this.collectingGiftId) return;
    this.collectingGiftId = card.id;
    try {
      const defaultAmount = Number(card.initialAmount ?? card.balance ?? 0) || 0;
      const amount = await this.openCollectPaymentDialog({
        title: 'Incassa Gift Card',
        subtitle: `Codice: ${card.code}`,
        defaultAmountEuro: defaultAmount,
        bookingId: `gift:${card.id}`,
        description: `Acquisto gift card ${card.code}`,
        referenceType: 'gift_card',
        referenceId: card.id,
        referenceLabel: card.code
      });
      if (amount == null) return;

      console.log('[BonusAdmin] gift card payment collected', {
        giftId: card.id,
        code: card.code,
        amount
      });
    } finally {
      this.collectingGiftId = null;
    }
  }

  async createGiftCard(): Promise<void> {
    if (this.giftForm.invalid || this.savingGift) return;

    this.savingGift = true;
    try {
      await this.bonusService.createGiftCard({
        name: this.giftForm.value.name || undefined,
        amount: Number(this.giftForm.value.amount),
        expiresAt: this.giftForm.value.expiresAt || null,
        note: this.giftForm.value.note || undefined
      });

      this.giftForm.reset({
        name: '',
        amount: 50,
        expiresAt: '',
        note: ''
      });
      this.dialog.closeAll();
    } catch (error) {
      console.error('[BonusAdminComponent] createGiftCard error', error);
    } finally {
      this.savingGift = false;
    }
  }

  trackGift(_index: number, item: GiftCard): string {
    return item.id;
  }

  isAssigned(card: GiftCard): boolean {
    return !!String(card.redeemedBy ?? '').trim();
  }

  giftTarget(card: GiftCard): string {
    if (!card.gifted) return '-';
    return card.giftedToName || card.giftedToEmail || card.giftedToPhone || card.giftedToUserId || '-';
  }

  statusLabel(card: GiftCard): string {
    if (card.status === 'redeemed') return 'Riscattata';
    if (card.status === 'partially_redeemed') return 'Parzialmente usata';
    if (card.status === 'expired') return 'Scaduta';
    if (card.status === 'disabled') return 'Disattiva';
    return 'Attiva';
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
