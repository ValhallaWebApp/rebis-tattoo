import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app.component';
import { AuthService } from './core/services/auth/auth.service';
import { AppMenuFacade } from './core/services/menu/app-menu.facade';
import { NotificationService } from './core/services/notifications/notification.service';

describe('AppComponent', () => {
  const authStub = {
    userSig: () => null,
    logout: jasmine.createSpy('logout')
  };

  const appMenuFacadeStub = {
    menuItems: () => [],
    isMenuOpen: () => false,
    isLoggedIn: () => false,
    userRole: () => 'public',
    toggleMenu: jasmine.createSpy('toggleMenu'),
    closeMenu: jasmine.createSpy('closeMenu'),
    setMenuOpen: jasmine.createSpy('setMenuOpen')
  };

  const notificationStub = {
    getUserNotifications: jasmine.createSpy('getUserNotifications').and.returnValue(of([])),
    getUnreadCount: jasmine.createSpy('getUnreadCount').and.returnValue(of(0)),
    markAsRead: jasmine.createSpy('markAsRead').and.resolveTo(undefined),
    resolveNotificationLink: jasmine.createSpy('resolveNotificationLink').and.returnValue('/home'),
    markAllAsRead: jasmine.createSpy('markAllAsRead').and.resolveTo(undefined)
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
        { provide: AppMenuFacade, useValue: appMenuFacadeStub },
        { provide: NotificationService, useValue: notificationStub }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
