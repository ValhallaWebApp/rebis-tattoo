import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, DestroyRef, computed, effect, Inject, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSidenav } from '@angular/material/sidenav';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Observable, filter, of } from 'rxjs';
import { AuthService } from './core/services/auth/auth.service';
import { MaterialModule } from './core/modules/material.module';
import { AppNotification } from './core/models/notification.model';
import { NotificationService } from './core/services/notifications/notification.service';
import { RebisChatbotPopupComponent } from './shared/components/chat-bot/rebis-chatbot-popup.component';
import { AppMenuFacade } from './core/services/menu/app-menu.facade';
import { AdminSectionsVisibilityService } from './core/services/menu/admin-sections-visibility.service';
import { LanguageService } from './core/services/language/language.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterModule, MaterialModule, RebisChatbotPopupComponent],
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  @ViewChild('sidenav') sidenav!: MatSidenav;
  private readonly destroyRef = inject(DestroyRef);
  private readonly menuFacade = inject(AppMenuFacade);
  private readonly sectionsVisibility = inject(AdminSectionsVisibilityService);
  readonly lang = inject(LanguageService);

  modeSidenav: 'over' | 'side' = 'over';
  activeTheme: 'public' | 'client' | 'admin' = 'public';
  readonly menuItems = this.menuFacade.menuItems;
  readonly isMenuOpen = this.menuFacade.isMenuOpen;
  readonly isLoggedIn = this.menuFacade.isLoggedIn;
  readonly userRole = this.menuFacade.userRole;
  readonly showChatbot = computed(() => {
    const role = this.userRole();
    if (role === 'admin' || role === 'staff') return false;
    const clientChatVisible = this.sectionsVisibility.isVisible('/dashboard/chat');
    return clientChatVisible;
  });

  notifications$: Observable<AppNotification[]> = of([]);
  unreadCount$: Observable<number> = of(0);

  constructor(
    private auth: AuthService,
    private notificationService: NotificationService,
    private router: Router,
    @Inject(DOCUMENT) private document: Document
  ) {}

  private userEffect = effect(() => {
    const user = this.auth.userSig();

    if (user) {
      this.bindNotifications(user.uid);
      return;
    }

    this.notifications$ = of([]);
    this.unreadCount$ = of(0);
  });

  ngOnInit(): void {
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
    this.menuFacade.toggleMenu();
  }

  closeMenu(): void {
    this.menuFacade.closeMenu();
  }

  onMenuOpenChange(isOpen: boolean): void {
    this.menuFacade.setMenuOpen(isOpen);
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

    const role = this.userRole();
    const target = this.notificationService.resolveNotificationLink(notification, role);
    await this.router.navigateByUrl(target);
  }

  async markAllNotificationsAsRead(): Promise<void> {
    const user = this.auth.userSig();
    if (!user) return;

    await this.notificationService.markAllAsRead(user.uid);
  }
}


