import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from '../../../../core/modules/material.module';
import { UserService, User, UserRole } from '../../../../core/services/users/user.service';
import { MatDialog } from '@angular/material/dialog';
import { combineLatest, firstValueFrom } from 'rxjs';
import { UserEditDialogComponent } from './user-edit-dialog.component';
import { StaffMember, StaffService } from '../../../../core/services/staff/staff.service';
import { DynamicField, DynamicFormComponent } from '../../../../shared/components/form/dynamic-form/dynamic-form.component';

@Component({
  selector: 'app-users-management',
  standalone: true,
  templateUrl: './users-management.component.html',
  styleUrls: ['./users-management.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, DynamicFormComponent]
})
export class UsersManagementComponent implements OnInit {
  readonly avatarFallback = '/loghi/logo.png';
  readonly allowedRoles: UserRole[] = ['client', 'staff', 'admin'];
  activeRoleTab: 'client' | 'staff' = 'client';
  readonly filterFields: DynamicField[] = [
    { type: 'text', name: 'name', label: 'Nome', placeholder: 'Mario Rossi' },
    { type: 'email', name: 'email', label: 'Email', placeholder: 'mario@email.com' }
  ];
  filterForm!: FormGroup;
  allUsers: User[] = [];
  filteredUsers: User[] = [];
  staffProfilesByUserId: Record<string, StaffMember> = {};
  roles: UserRole[] = ['client', 'staff', 'admin'];
  pageTitle = 'Gestione Utenti';
  private defaultRoleFromRoute: UserRole | '' = 'client';
  pageSizeOptions: number[] = [5, 15, 20];
  pageSize = 15;
  currentPage = 1;
  updatingRoleByUserId: Record<string, boolean> = {};
  updatingRolePermissionByUserId: Record<string, boolean> = {};
  updatingStatusByUserId: Record<string, boolean> = {};

  constructor(
    private fb: FormBuilder,
    public userService: UserService,
    private staffService: StaffService,
    private dialog: MatDialog,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      name: [''],
      email: [''],
      userId: [''],
      q: ['']
    });

    this.route.data.subscribe((data) => {
      const routeRole = String(data['defaultRole'] ?? '').trim().toLowerCase();
      this.defaultRoleFromRoute = this.roles.includes(routeRole as UserRole) ? (routeRole as UserRole) : '';
      this.pageTitle = String(data['pageTitle'] ?? 'Gestione Utenti');
      this.applyRouteFilters();
    });
    this.route.queryParamMap.subscribe(() => this.applyRouteFilters());

    if (this.userService.isCurrentUserAdmin()) {
      void this.staffService.backfillPublicStaffFromCurrentData().catch(() => {
        // best effort backfill
      });
    }

    combineLatest([this.userService.getManageableUsers(), this.staffService.getAllStaff()]).subscribe(([users, staff]) => {
      this.allUsers = (users ?? []).filter(user => this.allowedRoles.includes(this.displayRole(user) as UserRole));
      this.staffProfilesByUserId = (staff ?? []).reduce((acc, item) => {
        const key = String(item.userId ?? item.id ?? '').trim();
        if (key) acc[key] = item;
        return acc;
      }, {} as Record<string, StaffMember>);
      this.applyFilters();
    });

    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
  }

  applyFilters(): void {
    const { name, email, userId, q } = this.filterForm.value;
    const idFilter = String(userId ?? '').trim().toLowerCase();
    const generic = String(q ?? '').trim().toLowerCase();

    this.filteredUsers = this.allUsers.filter(user => {
      const normalizedRole = String(user.role ?? '').toLowerCase();
      const userName = String(user.name ?? '').toLowerCase();
      const userEmail = String(user.email ?? '').toLowerCase();
      const userIdVal = String(user.id ?? '').toLowerCase();
      const userPhone = String((user as any).phone ?? '').toLowerCase();
      const genericHay = `${userIdVal} ${userName} ${userEmail} ${userPhone}`;

      return (
        normalizedRole === this.activeRoleTab &&
        (!name || userName.includes(String(name).toLowerCase())) &&
        (!email || userEmail.includes(String(email).toLowerCase())) &&
        (!idFilter || userIdVal === idFilter)
        && (!generic || genericHay.includes(generic))
      );
    });
    this.currentPage = 1;
  }

  private applyRouteFilters(): void {
    const qpm = this.route.snapshot.queryParamMap;
    const roleFromQuery = String(qpm.get('role') ?? '').trim().toLowerCase();
    const roleFilter = this.roles.includes(roleFromQuery as UserRole)
      ? roleFromQuery as UserRole
      : this.defaultRoleFromRoute;
    this.activeRoleTab = roleFilter === 'staff' ? 'staff' : 'client';
    const userId = String(qpm.get('userId') ?? qpm.get('uid') ?? '').trim();
    const q = String(qpm.get('q') ?? '').trim();
    this.filterForm.patchValue(
      {
        userId,
        q
      },
      { emitEvent: false }
    );
    this.applyFilters();
  }

  onRoleTabChange(tab: 'client' | 'staff'): void {
    this.activeRoleTab = tab;
    this.currentPage = 1;
    this.applyFilters();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize));
  }

  get pagedUsers(): User[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  onPageSizeChange(size: number): void {
    if (!this.pageSizeOptions.includes(size)) return;
    this.pageSize = size;
    this.currentPage = 1;
  }

  previousPage(): void {
    if (this.currentPage <= 1) return;
    this.currentPage -= 1;
  }

  nextPage(): void {
    if (this.currentPage >= this.totalPages) return;
    this.currentPage += 1;
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
    return user.role;
  }

  canChangeRole(user: User): boolean {
    return this.userService.isCurrentUserAdmin() && !this.isRoleUpdating(user.id);
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

  async changeUserRole(user: User, nextRole: 'admin' | 'client' | 'staff'): Promise<void> {
    const currentRole = this.displayRole(user);
    if (!this.canChangeRole(user) || currentRole === nextRole) return;

    this.updatingRoleByUserId[user.id] = true;
    try {
      await this.userService.updateUser(user.id, { role: nextRole });
      this.applyFilters();
    } finally {
      this.updatingRoleByUserId[user.id] = false;
    }
  }

  roleOptionsFor(_user: User): Array<'admin' | 'client' | 'staff'> {
    return this.userService.getAssignableRolesForCurrentUser();
  }

  getStaffProfile(user: User): StaffMember | null {
    const key = String(user.id ?? '').trim();
    return this.staffProfilesByUserId[key] ?? null;
  }

  displayStaffRole(user: User): string {
    const role = String(this.getStaffProfile(user)?.role ?? 'staff').trim();
    return role || 'staff';
  }

  displayStaffBio(user: User): string {
    return String(this.getStaffProfile(user)?.bio ?? '').trim();
  }

  getStaffAvatarUrl(user: User): string {
    const profile = this.getStaffProfile(user);
    const candidate = String(profile?.photoUrl ?? '').trim();
    return candidate || this.getAvatarUrl(user);
  }

  openStaffDetail(user: User): void {
    const id = String(user.id ?? '').trim();
    if (!id) return;
    this.router.navigate(['/admin/staff', id]);
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
      this.applyFilters();
    } finally {
      this.updatingStatusByUserId[user.id] = false;
    }
  }

  async editUser(user: User): Promise<void> {
    if (!this.userService.isCurrentUserAdmin()) return;
    const dialogRef = this.dialog.open(UserEditDialogComponent, {
      width: '560px',
      data: { user, isAdmin: true }
    });

    const patch = await firstValueFrom(dialogRef.afterClosed());
    if (!patch) return;

    await this.userService.updateUser(user.id, patch);
    this.applyFilters();
  }
}
