import { Injectable, effect, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { MenuItem, MenuService, MenuUserContext } from './menu.service';
import { AdminSectionsVisibilityService } from './admin-sections-visibility.service';

export type AppMenuRole = 'public' | 'client' | 'staff' | 'admin';

@Injectable({ providedIn: 'root' })
export class AppMenuFacade {
  private readonly _isMenuOpen = signal(false);
  private readonly _isLoggedIn = signal(false);
  private readonly _userRole = signal<AppMenuRole>('public');
  private readonly _menuItems = signal<MenuItem[]>([]);

  readonly isMenuOpen = this._isMenuOpen.asReadonly();
  readonly isLoggedIn = this._isLoggedIn.asReadonly();
  readonly userRole = this._userRole.asReadonly();
  readonly menuItems = this._menuItems.asReadonly();

  constructor(
    private readonly auth: AuthService,
    private readonly menuService: MenuService,
    private readonly sectionsVisibility: AdminSectionsVisibilityService
  ) {
    effect(() => {
      const user = this.auth.userSig();
      this.sectionsVisibility.visibility();
      this._isLoggedIn.set(!!user);
      const role = this.normalizeRole(user?.role);
      this._userRole.set(role);
      void this.refreshMenu(user);
    }, { allowSignalWrites: true });
  }

  toggleMenu(): void {
    this._isMenuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this._isMenuOpen.set(false);
  }

  setMenuOpen(isOpen: boolean): void {
    this._isMenuOpen.set(isOpen);
  }

  private async refreshMenu(user: MenuUserContext | null): Promise<void> {
    const items = await firstValueFrom(this.menuService.getMenuByUser(user));
    this._menuItems.set(items ?? []);
  }

  private normalizeRole(role: string | undefined): AppMenuRole {
    if (role === 'admin' || role === 'client' || role === 'staff' || role === 'public') return role;
    return 'public';
  }
}
