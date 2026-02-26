import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MaterialModule } from '../../../../core/modules/material.module';
import { Invoice, InvoicesService } from '../../../../core/services/invoices/invoices.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { DynamicField, DynamicFormComponent } from '../../../../shared/components/form/dynamic-form/dynamic-form.component';
import { FormGroup } from '@angular/forms';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, DynamicFormComponent],
  templateUrl: './billing.component.html',
  styleUrls: ['./billing.component.scss']
})
export class BillingComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  selectedStatusCtrl = new FormControl<'all' | 'pending' | 'paid' | 'cancelled'>('all', { nonNullable: true });
  readonly filterForm = new FormGroup({
    selectedStatusCtrl: this.selectedStatusCtrl
  });
  readonly filterFields: DynamicField[] = [
    {
      type: 'button-toggle',
      name: 'selectedStatusCtrl',
      label: 'Scegli stato fatture',
      options: [
        { label: 'Tutte', value: 'all' },
        { label: 'In sospeso', value: 'pending' },
        { label: 'Completate', value: 'paid' },
        { label: 'Annullate', value: 'cancelled' }
      ]
    }
  ];
  allInvoices: Invoice[] = []
  filteredPayments: Invoice[] = [];

  constructor(
    private invoiceService: InvoicesService,
    private router: Router,
    private auth: AuthService
  ) {}
  generateInvoicesFromBookings(): void {
  this.allInvoices.forEach(invoice => {
      this.invoiceService.addInvoice(invoice).then(() => {
        console.log(`✅ Fattura per ${invoice.clientName} inserita con successo.`);
      }).catch(err => {
        console.error(`❌ Errore durante l'inserimento di ${invoice.clientName}:`, err);
      });
    });
  }

  ngOnInit() {
    this.invoiceService.getInvoices().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((invoices) => {
      this.allInvoices = invoices;
      this.filterPayments();
    });

    this.selectedStatusCtrl.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.filterPayments());
}
markAsPaid(invoice: Invoice): void {
  this.invoiceService.updateInvoice(invoice.id!, {
    status: 'paid',
    updatedAt: new Date().toISOString()
  }).then(() => {
    invoice.status = 'paid';
    this.filterPayments();
    console.log('✅ Stato aggiornato a "paid" per', invoice.clientName);
  });
}

deleteInvoice(invoiceId: string): void {
  if (confirm('Sei sicuro di voler eliminare questa fattura?')) {
    this.invoiceService.deleteInvoice(invoiceId).then(() => {
      this.allInvoices = this.allInvoices.filter(inv => inv.id !== invoiceId);
      this.filterPayments();
      console.log('🗑️ Fattura eliminata');
    });
  }
}

getStatusColor(status: string): string {
  switch (status) {
    case 'paid': return 'primary';
    case 'pending': return 'accent';
    case 'cancelled': return 'warn';
    default: return '';
  }
}

  goToBooking(invoiceId: string) {
    // opzionale: naviga alla prenotazione o dettaglio fattura
    const base = this.auth.userSig()?.role === 'staff' ? '/staff' : '/admin';
    this.router.navigate([`${base}/invoices`, invoiceId]);
  }

  filterPayments() {
    const status = this.selectedStatusCtrl.value;
    if (status === 'all') {
      this.filteredPayments = this.allInvoices;
    } else {
      this.filteredPayments = this.allInvoices.filter(i => i.status === status);
    }
  }
}


