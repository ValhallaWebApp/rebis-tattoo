import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';
import { UserService, User, UserRole } from '../../../../core/services/users/user.service';
import { addQuarters } from 'date-fns';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, MaterialModule]
})
export class ClientsListComponent implements OnInit {
  filterForm!: FormGroup;
  allUsers: User[] = [];
  filteredUsers: User[] = [];
  roles: UserRole[] = ['admin', 'staff', 'client', 'guest'];

  constructor(private fb: FormBuilder, private userService: UserService) {}

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      name: [''],
      email: [''],
      role: ['']
    });

    this.userService.getClients().subscribe(users => {
      this.allUsers = users;
      console.log(users)
      this.applyFilters();
    });

    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
  }

  applyFilters(): void {
    const { name, email, role } = this.filterForm.value;

    this.filteredUsers = this.allUsers.filter(user => {
      return (
        (!name || user.name.toLowerCase().includes(name.toLowerCase())) &&
        (!email || user.email.toLowerCase().includes(email.toLowerCase())) &&
        (!role || user.role === role)
      );
    });
  }

  editUser(user: User): void {
    console.log('Modifica utente:', user);
    // TODO: Apri dialog
  }

  viewAppointments(user: User): void {  addQuarters
    console.log('Visualizza appuntamenti per:', user.id);
    // TODO: Navigazione
  }

  contactUser(user: User): void {
    console.log('Contatta utente:', user.email);
    // TODO: Messaging
  }
}
