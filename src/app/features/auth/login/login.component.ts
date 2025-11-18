import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { MaterialModule } from '../../../core/modules/material.module';
import { AuthService } from '../../../core/services/auth/authservice';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [MaterialModule, CommonModule, MatProgressSpinnerModule, ReactiveFormsModule]
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoginMode = true;
  errorMessage = '';
  isLoading = false;

  constructor(private authService: AuthService, private fb: FormBuilder, private router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [true]
    });
  }

  toggleMode() {
    this.isLoginMode = !this.isLoginMode;
    this.errorMessage = '';
  }

  async onSubmit() {
    if (this.loginForm.invalid || this.isLoading) return;

    const { email, password, rememberMe } = this.loginForm.value as
      { email: string; password: string; rememberMe: boolean };

    const redirectPath = localStorage.getItem('pre-log') || '/home';
    this.isLoading = true;
    this.errorMessage = '';

    try {
      // ✅ imposta persistenza PRIMA del login/register
      // await this.authService.setAuthPersistence(rememberMe);

      if (this.isLoginMode) {
        await this.authService.login(email, password);
      } else {
        await this.authService.register(email, password);
      }

      await this.router.navigateByUrl(redirectPath);
      localStorage.removeItem('pre-log');
    } catch (err: any) {
      const code = err?.code || err?.message || 'unknown';
      this.errorMessage = this.getErrorMessage(code);
      console.error('Auth error:', err);
    } finally {
      this.isLoading = false;
    }
  }

  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'Utente non trovato.';
      case 'auth/wrong-password':
        return 'Password errata.';
      case 'auth/email-already-in-use':
        return 'Email già registrata.';
      case 'auth/invalid-email':
        return 'Email non valida.';
      case 'auth/weak-password':
        return 'Password troppo debole.';
      case 'profile/not-found':
        return 'Profilo non trovato. Contatta il supporto oppure riprova più tardi.';
      default:
        return 'Errore sconosciuto. Riprova.';
    }
  }
}
