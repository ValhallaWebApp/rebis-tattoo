import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';
import { UserService, User, UserRole } from '../../../../core/services/users/user.service';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { UserEditDialogComponent } from './user-edit-dialog.component';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, MaterialModule]
})
export class ClientsListComponent implements OnInit {
  readonly avatarFallback = '/loghi/logo.png';
  filterForm!: FormGroup;
  allUsers: User[] = [];
  filteredUsers: User[] = [];
  roles: UserRole[] = ['admin', 'user', 'staff'];
  roleOptions: Array<'admin' | 'user' | 'staff'> = ['admin', 'user', 'staff'];
  updatingRoleByUserId: Record<string, boolean> = {};
  updatingRolePermissionByUserId: Record<string, boolean> = {};
  updatingStatusByUserId: Record<string, boolean> = {};

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      name: [''],
      email: [''],
      role: ['']
    });

    this.userService.getManageableUsers().subscribe(users => {
      this.allUsers = users;
      this.applyFilters();
    });

    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
  }

  applyFilters(): void {
    const { name, email, role } = this.filterForm.value;

    this.filteredUsers = this.allUsers.filter(user => {
      const normalizedRole = user.role === 'client' ? 'user' : user.role;
      return (
        (!name || user.name.toLowerCase().includes(name.toLowerCase())) &&
        (!email || user.email.toLowerCase().includes(email.toLowerCase())) &&
        (!role || normalizedRole === role)
      );
    });
  }

  getAvatarUrl(user: User): string {
    const candidates = [
      user.urlAvatar,
      (user as any).avatar,
      (user as any).photoUrl
    ];
    const valid = candidates.find(v => typeof v === 'string' && v.trim().length > 0);
    return valid ? String(valid).trim() : this.avatarFallback;
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    if (img.src.includes(this.avatarFallback)) return;
    img.src = this.avatarFallback;
  }

  displayRole(user: User): string {
    return user.role === 'client' ? 'user' : user.role;
  }

  canChangeRole(user: User): boolean {
    if (!this.userService.canCurrentUserManageRoles()) return false;

    const currentRole = this.userService.getCurrentUserRole();
    const role = this.displayRole(user);
    if (!(role === 'admin' || role === 'user' || role === 'staff')) return false;
    if (currentRole === 'staff' && role === 'admin') return false;
    return true;
  }

  isRoleUpdating(userId: string): boolean {
    return this.updatingRoleByUserId[userId] === true;
  }

  isStatusUpdating(userId: string): boolean {
    return this.updatingStatusByUserId[userId] === true;
  }

  isSelf(user: User): boolean {
    return this.userService.getCurrentUserId() === user.id;
  }

  async changeUserRole(user: User, nextRole: 'admin' | 'user' | 'staff'): Promise<void> {
    const currentRole = this.displayRole(user);
    if (!this.canChangeRole(user) || currentRole === nextRole || this.isRoleUpdating(user.id)) return;

    this.updatingRoleByUserId[user.id] = true;
    try {
      await this.userService.updateUser(user.id, { role: nextRole });
      const updatedUsers = this.allUsers.map(item =>
        item.id === user.id
          ? {
              ...item,
              role: nextRole,
              permissions: nextRole === 'staff' ? item.permissions : { ...item.permissions, canManageRoles: false }
            }
          : item
      );
      this.allUsers = updatedUsers;
      this.applyFilters();
    } finally {
      this.updatingRoleByUserId[user.id] = false;
    }
  }

  roleOptionsFor(user: User): Array<'admin' | 'user' | 'staff'> {
    const currentRole = this.userService.getCurrentUserRole();
    if (currentRole === 'staff') return ['user', 'staff'];
    return this.roleOptions;
  }

  canGrantRolePermissionToggle(user: User): boolean {
    return this.userService.isCurrentUserAdmin() && this.displayRole(user) === 'staff';
  }

  hasRoleManagementPermission(user: User): boolean {
    return user.permissions?.canManageRoles === true;
  }

  isRolePermissionUpdating(userId: string): boolean {
    return this.updatingRolePermissionByUserId[userId] === true;
  }

  async toggleRolePermission(user: User, enabled: boolean): Promise<void> {
    if (!this.canGrantRolePermissionToggle(user) || this.isRolePermissionUpdating(user.id)) return;

    this.updatingRolePermissionByUserId[user.id] = true;
    try {
      await this.userService.updateUser(user.id, {
        permissions: {
          ...(user.permissions ?? {}),
          canManageRoles: enabled
        }
      });
      this.allUsers = this.allUsers.map(item =>
        item.id === user.id
          ? {
              ...item,
              permissions: {
                ...(item.permissions ?? {}),
                canManageRoles: enabled
              }
            }
          : item
      );
      this.applyFilters();
    } finally {
      this.updatingRolePermissionByUserId[user.id] = false;
    }
  }

  async toggleUserActive(user: User): Promise<void> {
    if (this.isStatusUpdating(user.id)) return;

    this.updatingStatusByUserId[user.id] = true;
    try {
      const next = !(user.isActive ?? true);
      await this.userService.updateUser(user.id, { isActive: next });
      this.allUsers = this.allUsers.map(item =>
        item.id === user.id ? { ...item, isActive: next } : item
      );
      this.applyFilters();
    } finally {
      this.updatingStatusByUserId[user.id] = false;
    }
  }

  async hideUser(user: User): Promise<void> {
    if (this.isStatusUpdating(user.id)) return;
    const ok = confirm(`Confermi di nascondere l'utente ${user.name}?`);
    if (!ok) return;

    this.updatingStatusByUserId[user.id] = true;
    try {
      await this.userService.deleteUser(user.id);
      this.allUsers = this.allUsers.filter(item => item.id !== user.id);
      this.applyFilters();
    } finally {
      this.updatingStatusByUserId[user.id] = false;
    }
  }

  async editUser(user: User): Promise<void> {
    const dialogRef = this.dialog.open(UserEditDialogComponent, {
      width: '560px',
      data: { user }
    });

    const patch = await firstValueFrom(dialogRef.afterClosed());
    if (!patch) return;

    await this.userService.updateUser(user.id, patch);
    this.allUsers = this.allUsers.map(item =>
      item.id === user.id ? { ...item, ...patch } : item
    );
    this.applyFilters();
  }

  viewAppointments(user: User): void {
    console.log('Visualizza appuntamenti per:', user.id);
    // TODO: Navigazione
  }

  contactUser(user: User): void {
    console.log('Contatta utente:', user.email);
    // TODO: Messaging
  }
}
