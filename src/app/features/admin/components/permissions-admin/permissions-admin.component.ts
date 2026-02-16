import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MaterialModule } from '../../../../core/modules/material.module';
import { StaffLevel, User, UserService } from '../../../../core/services/users/user.service';

type ManagedPermissionKey =
  | 'canManageRoles'
  | 'canManageBookings'
  | 'canManageProjects'
  | 'canManageSessions'
  | 'canReassignProjectArtist'
  | 'canReassignProjectClient';

type PermissionDefinition = {
  key: ManagedPermissionKey;
  label: string;
  description: string;
};

@Component({
  selector: 'app-permissions-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './permissions-admin.component.html',
  styleUrl: './permissions-admin.component.scss'
})
export class PermissionsAdminComponent implements OnInit {
  staffUsers: User[] = [];
  loading = true;
  updatingByUserId: Record<string, boolean> = {};
  readonly pageSizeOptions = [5, 15, 20];
  pageSize = 5;
  pageIndex = 0;
  selectedUserId: string | null = null;
  readonly permissionDefinitions: PermissionDefinition[] = [
    {
      key: 'canManageRoles',
      label: 'Gestione Ruoli',
      description: 'Consente di modificare ruoli utente non admin.'
    },
    {
      key: 'canManageBookings',
      label: 'Gestione Prenotazioni',
      description: 'Consente creazione/modifica prenotazioni.',
    },
    {
      key: 'canManageProjects',
      label: 'Gestione Progetti',
      description: 'Consente creazione/modifica progetti.',
    },
    {
      key: 'canManageSessions',
      label: 'Gestione Sessioni',
      description: 'Consente gestione sessioni di lavoro.',
    },
    {
      key: 'canReassignProjectArtist',
      label: 'Cambio Artista Progetto',
      description: 'Consente di riassegnare l artista di un progetto.',
    },
    {
      key: 'canReassignProjectClient',
      label: 'Cambio Cliente Progetto',
      description: 'Consente di riassegnare il cliente di un progetto.',
    }
  ];
  readonly levelOptions: StaffLevel[] = ['junior', 'operator', 'senior', 'manager'];
  private readonly levelPresets: Record<StaffLevel, Record<ManagedPermissionKey, boolean>> = {
    junior: {
      canManageRoles: false,
      canManageBookings: true,
      canManageProjects: false,
      canManageSessions: false,
      canReassignProjectArtist: false,
      canReassignProjectClient: false
    },
    operator: {
      canManageRoles: false,
      canManageBookings: true,
      canManageProjects: true,
      canManageSessions: true,
      canReassignProjectArtist: false,
      canReassignProjectClient: false
    },
    senior: {
      canManageRoles: false,
      canManageBookings: true,
      canManageProjects: true,
      canManageSessions: true,
      canReassignProjectArtist: true,
      canReassignProjectClient: true
    },
    manager: {
      canManageRoles: true,
      canManageBookings: true,
      canManageProjects: true,
      canManageSessions: true,
      canReassignProjectArtist: true,
      canReassignProjectClient: true
    }
  };

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.userService.getManageableUsers().subscribe(users => {
      this.staffUsers = (users ?? [])
        .filter(u => this.displayRole(u) === 'staff' && u.isVisible !== false && !u.deletedAt)
        .sort((a, b) => this.sortKey(a).localeCompare(this.sortKey(b)));
      this.ensureSelectionConsistency();
      this.loading = false;
    });
  }

  displayRole(user: User): string {
    return user.role === 'client' ? 'user' : user.role;
  }

  hasPermission(user: User, key: ManagedPermissionKey): boolean {
    return user.permissions?.[key] === true;
  }

  isUpdating(userId: string): boolean {
    return this.updatingByUserId[userId] === true;
  }

  pagedUsers(): User[] {
    const start = this.pageIndex * this.pageSize;
    return this.staffUsers.slice(start, start + this.pageSize);
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.staffUsers.length / this.pageSize));
  }

  pageLabel(): string {
    if (!this.staffUsers.length) return '0 / 0';
    return `${this.pageIndex + 1} / ${this.totalPages()}`;
  }

  changePageSize(size: number): void {
    if (!this.pageSizeOptions.includes(size)) return;
    this.pageSize = size;
    this.pageIndex = 0;
    this.ensureSelectionConsistency();
  }

  prevPage(): void {
    if (this.pageIndex <= 0) return;
    this.pageIndex--;
    this.ensureSelectionConsistency();
  }

  nextPage(): void {
    if (this.pageIndex >= this.totalPages() - 1) return;
    this.pageIndex++;
    this.ensureSelectionConsistency();
  }

  selectUser(userId: string): void {
    this.selectedUserId = userId;
  }

  isSelected(userId: string): boolean {
    return this.selectedUserId === userId;
  }

  selectedUser(): User | undefined {
    if (!this.selectedUserId) return undefined;
    return this.staffUsers.find(u => u.id === this.selectedUserId);
  }

  currentStaffLevel(user: User): StaffLevel {
    const level = String((user as any).staffLevel ?? '').trim().toLowerCase() as StaffLevel;
    if (this.levelOptions.includes(level)) return level;
    return this.inferLevelFromPermissions(user);
  }

  async changeStaffLevel(user: User, level: StaffLevel): Promise<void> {
    if (this.isUpdating(user.id)) return;
    this.updatingByUserId[user.id] = true;
    try {
      const preset = this.levelPresets[level];
      await this.userService.updateUser(user.id, {
        staffLevel: level,
        permissions: {
          ...(user.permissions ?? {}),
          ...preset
        }
      });
    } finally {
      this.updatingByUserId[user.id] = false;
    }
  }

  async togglePermission(user: User, key: ManagedPermissionKey, enabled: boolean): Promise<void> {
    if (this.isUpdating(user.id)) return;
    this.updatingByUserId[user.id] = true;
    try {
      await this.userService.updateUser(user.id, {
        permissions: {
          ...(user.permissions ?? {}),
          [key]: enabled
        }
      });
    } finally {
      this.updatingByUserId[user.id] = false;
    }
  }

  private inferLevelFromPermissions(user: User): StaffLevel {
    const p = user.permissions ?? {};
    if (p.canManageRoles === true) return 'manager';
    if (p.canReassignProjectArtist === true || p.canReassignProjectClient === true) return 'senior';
    if (p.canManageProjects === true || p.canManageSessions === true) return 'operator';
    return 'junior';
  }

  private sortKey(user: User): string {
    const name = String(user.name ?? '').trim().toLowerCase();
    const email = String(user.email ?? '').trim().toLowerCase();
    return name || email || String(user.id ?? '').toLowerCase();
  }

  private ensureSelectionConsistency(): void {
    const pages = this.totalPages();
    if (this.pageIndex > pages - 1) this.pageIndex = pages - 1;
    if (this.pageIndex < 0) this.pageIndex = 0;

    const currentSelectionExists = this.selectedUserId
      ? this.staffUsers.some(u => u.id === this.selectedUserId)
      : false;
    if (currentSelectionExists) return;

    this.selectedUserId = this.pagedUsers()[0]?.id ?? null;
  }
}
