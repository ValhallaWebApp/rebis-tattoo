import { CommonModule } from '@angular/common';
import { Component, effect, OnInit, ViewChild } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { Router, RouterModule } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from './core/services/auth/authservice';
import { MenuItem, MenuService } from './core/services/menu/menu.service';
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

  modeSidenav: 'over' | 'side' = 'over';
  isMenuOpen = false;
  userRole: 'public' | 'client' | 'staff' | 'admin' = 'public';
  navItem$!: Observable<MenuItem[]>;
  isLoggedIn = false;

  notifications$: Observable<AppNotification[]> = of([]);
  unreadCount$: Observable<number> = of(0);

  constructor(
    private menuService: MenuService,
    private auth: AuthService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  private userEffect = effect(() => {
    const user = this.auth.userSig();
    this.isLoggedIn = !!user;

    if (user) {
      this.loadMenu(this.toMenuRole(user.role));
      this.bindNotifications(user.uid);
      return;
    }

    this.loadMenu('public');
    this.notifications$ = of([]);
    this.unreadCount$ = of(0);
  });

  ngOnInit(): void {
    this.loadMenu('public');
  }

  loadMenu(role: 'public' | 'client' | 'staff' | 'admin'): void {
    this.userRole = role;
    this.navItem$ = this.menuService.getMenuByRole(role);
  }

  private toMenuRole(role: string | undefined): 'public' | 'client' | 'staff' | 'admin' {
    if (role === 'admin' || role === 'client' || role === 'staff' || role === 'public') return role;
    return 'public';
  }

  private bindNotifications(userId: string): void {
    this.notifications$ = this.notificationService.getUserNotifications(userId);
    this.unreadCount$ = this.notificationService.getUnreadCount(userId);
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
