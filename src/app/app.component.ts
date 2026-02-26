import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, DestroyRef, effect, Inject, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSidenav } from '@angular/material/sidenav';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Observable, of, filter } from 'rxjs';
import { AuthService } from './core/services/auth/auth.service';
import { MenuItem, MenuService, MenuUserContext } from './core/services/menu/menu.service';
import { MaterialModule } from './core/modules/material.module';
import { AppNotification } from './core/models/notification.model';
import { NotificationService } from './core/services/notifications/notification.service';
import { ChatBotPopupComponent } from './shared/components/chat-bot/chat-bot-popup.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterModule, MaterialModule, ChatBotPopupComponent],
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  @ViewChild('sidenav') sidenav!: MatSidenav;
  private readonly destroyRef = inject(DestroyRef);

  modeSidenav: 'over' | 'side' = 'over';
  isMenuOpen = false;
  activeTheme: 'public' | 'client' | 'admin' = 'public';
  userRole: 'public' | 'client' | 'staff' | 'admin' = 'public';
  navItem$!: Observable<MenuItem[]>;
  isLoggedIn = false;

  notifications$: Observable<AppNotification[]> = of([]);
  unreadCount$: Observable<number> = of(0);

  constructor(
    private menuService: MenuService,
    private auth: AuthService,
    private notificationService: NotificationService,
    private router: Router,
    @Inject(DOCUMENT) private document: Document
  ) {}

  private userEffect = effect(() => {
    const user = this.auth.userSig();
    this.isLoggedIn = !!user;

    if (user) {
      this.loadMenuForUser(user);
      this.bindNotifications(user.uid);
      return;
    }

    this.loadMenuForUser(null);
    this.notifications$ = of([]);
    this.unreadCount$ = of(0);
  });

  ngOnInit(): void {
    this.loadMenuForUser(null);
    this.applyThemeByUrl(this.router.url);

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(event => {
        this.applyThemeByUrl(event.urlAfterRedirects || event.url);
      });
  }

  loadMenuForUser(user: MenuUserContext | null): void {
    const role = this.toMenuRole(user?.role);
    this.userRole = role;
    this.navItem$ = this.menuService.getMenuByUser(user);
  }

  private toMenuRole(role: string | undefined): 'public' | 'client' | 'staff' | 'admin' {
    if (role === 'admin' || role === 'client' || role === 'staff' || role === 'public') return role;
    return 'public';
  }

  private bindNotifications(userId: string): void {
    this.notifications$ = this.notificationService.getUserNotifications(userId);
    this.unreadCount$ = this.notificationService.getUnreadCount(userId);
  }

  private applyThemeByUrl(url: string): void {
    const nextTheme = this.resolveThemeByUrl(url);
    this.activeTheme = nextTheme;

    const classList = this.document.body.classList;
    classList.remove('theme-public', 'theme-client', 'theme-admin');
    classList.add(`theme-${nextTheme}`);
  }

  private resolveThemeByUrl(url: string): 'public' | 'client' | 'admin' {
    const normalizedUrl = (url || '').toLowerCase();

    if (normalizedUrl.startsWith('/dashboard')) {
      return 'client';
    }

    if (normalizedUrl.startsWith('/admin') || normalizedUrl.startsWith('/staff')) {
      return 'admin';
    }

    return 'public';
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  logout(): void {
    this.auth.logout();
  }

  async openNotification(notification: AppNotification): Promise<void> {
    const user = this.auth.userSig();
    if (!user) return;

    if (!notification.readAt) {
      await this.notificationService.markAsRead(user.uid, notification.id);
    }

    const role = this.toMenuRole(user.role);
    const target = this.notificationService.resolveNotificationLink(notification, role);
    await this.router.navigateByUrl(target);
  }

  async markAllNotificationsAsRead(): Promise<void> {
    const user = this.auth.userSig();
    if (!user) return;

    await this.notificationService.markAllAsRead(user.uid);
  }
}


