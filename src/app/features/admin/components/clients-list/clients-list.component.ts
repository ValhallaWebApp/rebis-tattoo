import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';
import { Client, ClientService } from '../../../../core/services/clients/client.service';

@Component({
  selector: 'app-clients-list',
    standalone: true,
  imports: [CommonModule,FormsModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss']
})
export class ClientsListComponent implements OnInit {
  filterForm!: FormGroup;
  allClients: Client[] = [];
  filteredClients: Client[] = [];

  constructor(
    private fb: FormBuilder,
    private clientService: ClientService
  ) {}

ngOnInit(): void {
  this.filterForm = this.fb.group({
    name: [''],
    email: [''],
    phone: [''],
    minPrice: [''],
    ongoing: [false]
  });

  this.clientService.getClients().subscribe((clients: any) => {
  this.allClients = clients.map((c: any) => ({
    id: c.id,
    name: c.name || 'Utente senza nome',
    email: c.email || '-',
    phone: c.phone || '-',
    tattooPrice: c.tattooPrice || 0, // ← questo campo è corretto
    ongoing: c.ongoing || false
  }));
  console.log(this.allClients

  )
  this.applyFilters();
  });

  this.filterForm.valueChanges.subscribe(() => this.applyFilters());
}

  applyFilters(): void {
    const { name, email, phone, minPrice, ongoing } = this.filterForm.value;

    this.filteredClients = this.allClients.filter(client => {
      return (
        (!name || client.name.toLowerCase().includes(name.toLowerCase())) &&
        (!email || client.email.toLowerCase().includes(email.toLowerCase())) &&
        (!phone || client.phone?.includes(phone))
        // (!minPrice || (client.tattooPrice || 0) >= +minPrice) &&
        // (!ongoing || client.ongoing === true)
      );
    });
  }

  editClient(client: Client): void {
    console.log('Modifica cliente:', client.name);
    // TODO: open dialog
  }

  viewAppointments(client: Client): void {
    console.log('Visualizza appuntamenti di', client.name);
    // TODO: redirect o query by client.id
  }

  contactClient(client: Client): void {
    console.log('Contatta', client.name);
    // TODO: redirect to /admin/messaging?client=xxx
  }
}

