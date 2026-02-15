import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from '../../../core/modules/material.module';
import { AuthService } from '../../../core/services/auth/authservice';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [MaterialModule, CommonModule, MatProgressSpinnerModule, ReactiveFormsModule]
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isLoginMode = true;
  errorMessage = '';
  isLoading = false;
  hidePassword = true;
  submitted = false;

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      name: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: [''],
      acceptTerms: [false],
      rememberMe: [true]
    }, {
      validators: [this.passwordsMatchValidator]
    });
  }

  ngOnInit() {
    const mode = this.router.url.includes('/register') || this.router.url.includes('/auth/register')
      ? 'register'
      : this.route.snapshot.data?.['mode'];
    if (mode === 'register') {
      this.isLoginMode = false;
    }
    this.configureValidatorsByMode();
  }

  get emailCtrl() {
    return this.loginForm.get('email');
  }

  get passwordCtrl() {
    return this.loginForm.get('password');
  }

  hasError(control: string, error: string): boolean {
    const c = this.loginForm.get(control);
    if (!c) return false;
    return c.hasError(error) && (c.touched || this.submitted);
  }

  toggleMode() {
    this.isLoginMode = !this.isLoginMode;
    this.errorMessage = '';
    this.submitted = false;
    this.configureValidatorsByMode();
    this.loginForm.markAsPristine();
    this.loginForm.markAsUntouched();
  }

  async onSubmit() {
    this.submitted = true;
    if (this.loginForm.invalid || this.isLoading) return;

    const { name, email, password, rememberMe } = this.loginForm.value as
      { name: string; email: string; password: string; rememberMe: boolean };

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
        const finalName = String(name ?? '').trim();
        if (finalName) {
          await this.authService.updateCurrentUserProfile({ name: finalName });
        }
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

  private configureValidatorsByMode(): void {
    const nameCtrl = this.loginForm.get('name');
    const confirmCtrl = this.loginForm.get('confirmPassword');
    const termsCtrl = this.loginForm.get('acceptTerms');
    const passwordCtrl = this.loginForm.get('password');

    if (!nameCtrl || !confirmCtrl || !termsCtrl || !passwordCtrl) return;

    if (this.isLoginMode) {
      nameCtrl.clearValidators();
      confirmCtrl.clearValidators();
      termsCtrl.clearValidators();
    } else {
      nameCtrl.setValidators([Validators.required, Validators.minLength(2)]);
      confirmCtrl.setValidators([Validators.required]);
      termsCtrl.setValidators([Validators.requiredTrue]);
    }

    passwordCtrl.setValidators([Validators.required, Validators.minLength(6)]);
    nameCtrl.updateValueAndValidity({ emitEvent: false });
    confirmCtrl.updateValueAndValidity({ emitEvent: false });
    termsCtrl.updateValueAndValidity({ emitEvent: false });
    passwordCtrl.updateValueAndValidity({ emitEvent: false });
    this.loginForm.updateValueAndValidity({ emitEvent: false });
  }

  private passwordsMatchValidator = (group: AbstractControl): ValidationErrors | null => {
    if (this.isLoginMode) return null;
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    if (!confirm) return null;
    return password === confirm ? null : { passwordMismatch: true };
  };

}
