import { Component, OnInit, ViewChild } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { MatSidenav } from '@angular/material/sidenav';
import { Database, ref, set } from '@angular/fire/database';
import { MenuItem, MenuService } from './core/services/menu/menu.service';
import { AuthService } from './core/services/auth/authservice';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MaterialModule } from './core/modules/material.module';
import { ChatBotComponent } from './shared/components/chat-bot/chat-bot.component';
import { ChatBotPopupComponent } from './shared/components/chat-bot/chat-bot-popup.component';
import { effect } from '@angular/core';

@Component({
  selector: 'app-root',
   imports: [
    CommonModule,
    RouterModule,
    MaterialModule,
    ChatBotPopupComponent
  ],
  standalone:true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  @ViewChild('sidenav') sidenav!: MatSidenav;
  modeSidenav:any = 'over';
  isMenuOpen = false;
  userRole: any = 'public'; // da rimpiazzare con valore dinamico dopo login
  navItem$!: Observable<MenuItem[]>;
  isLoggedIn: boolean = false;
  title: any;
notifications = [
  {
    message: 'Hai una seduta prevista per il 10 luglio alle 15:00.',
    icon: 'event',
    date: new Date('2025-07-10T15:00:00')
  },
  {
    message: 'La tua ultima recensione è stata approvata!',
    icon: 'check_circle',
    date: new Date('2025-07-07T09:00:00')
  },
  {
    message: 'Hai ricevuto una risposta nel messaggio con lo studio.',
    icon: 'chat',
    date: new Date('2025-07-06T17:30:00')
  }
];

  constructor(
    private menuService: MenuService,
    private auth: AuthService,
  ) {}
 private userEffect = effect(() => {
    const user = this.auth.userSig();
    console.log(user);
    if (user) {
      this.loadMenu(user.role);
    }
  });
isLoadingMenu = true;
ngOnInit() {
  this.loadMenu('public');
}






loadMenu(role:any): void {
  this.navItem$ = this.menuService.getMenuByRole(role); // menu completo
}


  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

  logout() {
    this.auth.logout(); // supponendo esista una funzione logout
  }
}
