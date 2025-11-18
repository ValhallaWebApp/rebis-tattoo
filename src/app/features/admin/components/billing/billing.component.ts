import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MaterialModule } from '../../../../core/modules/material.module';
import { Invoice, InvoicesService } from '../../../../core/services/invoices/invoices.service';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: './billing.component.html',
  styleUrls: ['./billing.component.scss']
})
export class BillingComponent implements OnInit {
  selectedStatus: string = 'all';
  allInvoices: Invoice[] = []
  filteredPayments: Invoice[] = [];

  constructor(private invoiceService: InvoicesService, private router: Router) {}
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
    this.invoiceService.getInvoices().subscribe((invoices) => {
      this.allInvoices = invoices;
      this.filterPayments();
    });
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
    this.router.navigate(['/admin/invoices', invoiceId]);
  }

  onStatusChange() {
    this.filterPayments();
  }

  filterPayments() {
    if (this.selectedStatus === 'all') {
      this.filteredPayments = this.allInvoices;
    } else {
      this.filteredPayments = this.allInvoices.filter(i => i.status === this.selectedStatus);
    }
  }
}
