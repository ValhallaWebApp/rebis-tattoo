import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from '../../../core/modules/material.module';
import { AppUser, AuthService } from '../../../core/services/auth/authservice';
import { UiFeedbackService } from '../../../core/services/ui/ui-feedback.service';

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
    private ui: UiFeedbackService,
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
    console.info('[AuthFlow][UI] submit.start', { isLoginMode: this.isLoginMode });
    this.submitted = true;
    if (this.loginForm.invalid || this.isLoading) return;

    const { name, email, password, rememberMe } = this.loginForm.value as
      { name: string; email: string; password: string; rememberMe: boolean };

    const preLoginRedirect = localStorage.getItem('pre-log');
    this.isLoading = true;
    this.errorMessage = '';

    try {
      // ✅ imposta persistenza PRIMA del login/register
      // await this.authService.setAuthPersistence(rememberMe);

      if (this.isLoginMode) {
        console.info('[AuthFlow][UI] login.flow.start', { email });
        await this.authService.login(email, password);
        this.ui.success('Accesso effettuato con successo.');
        const profileWarning = this.authService.consumeProfileWarning();
        if (profileWarning) {
          this.ui.warn(`Profilo utente incompleto: ${profileWarning}`);
        }
        const target = preLoginRedirect || this.getPostLoginRouteByRole();
        console.info('[AuthFlow][UI] login.flow.redirect', { target });
        await this.router.navigateByUrl(target);
        localStorage.removeItem('pre-log');
      } else {
        console.info('[AuthFlow][UI] register.flow.start', { email });
        const finalName = String(name ?? '').trim();
        const registerPayload: Partial<AppUser> = {
          id: '-',
          uid: '-',
          name: finalName || '-',
          email: email || '-',
          role: 'client',
          staffLevel: '-',
          permissions: {
            canManageRoles: false,
            canManageBookings: false,
            canManageProjects: false,
            canManageSessions: false,
            canReassignProjectArtist: false,
            canReassignProjectClient: false,
            canViewFinancials: false,
            canManageMessages: false,
            canManageServices: false,
            canManageBonus: false,
            canViewAnalytics: false,
            canViewAuditLogs: false
          },
          phone: '-',
          isActive: false,
          isVisible: false,
          deletedAt: null,
          createdAt: '-',
          updatedAt: '-',
          urlAvatar: '-',
          avatar: '-',
          dateOfBirth: '-',
          address: '-',
          city: '-',
          postalCode: '-',
          country: '-'
        };
        const registerResult = await this.authService.register(email, password, registerPayload);
        const userCreatedInDb = await this.authService.waitForUserRecord(registerResult.profile.uid);
        if (userCreatedInDb) {
          this.ui.success('Registrazione completata. Profilo database creato correttamente.');
          console.info('[AuthFlow][UI] register.flow.db_record_ok', { uid: registerResult.profile.uid });
        } else {
          console.error('[AuthFlow][UI] register.flow.db_record_incomplete', { uid: registerResult.profile.uid });
          this.ui.warn('Registrazione completata, ma il profilo risulta incompleto. Completa i dati dal profilo utente.');
        }
        await this.authService.logout();
        console.info('[AuthFlow][UI] register.flow.logout_done_switch_to_login');
        this.isLoginMode = true;
        this.configureValidatorsByMode();
        this.loginForm.patchValue({
          name: '',
          password: '',
          confirmPassword: '',
          acceptTerms: false
        });
        this.submitted = false;
        return;
      }
    } catch (err: any) {
      const code = err?.code || err?.message || 'unknown';
      this.errorMessage = this.getErrorMessage(code);
      console.error('[AuthFlow][UI] submit.error', { code, message: err?.message });
      console.error('Auth error:', err);
    } finally {
      this.isLoading = false;
      console.info('[AuthFlow][UI] submit.end', { isLoginMode: this.isLoginMode });
    }
  }

  private getPostLoginRouteByRole(): string {
    const role = this.authService.getUser()?.role;
    if (role === 'admin') return '/admin';
    if (role === 'staff') return '/staff';
    return '/home';
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
      case 'profile/incomplete':
        return 'Registrazione bloccata: profilo utente incompleto su database.';
      case 'profile/permission-denied':
        return 'Accesso bloccato: permessi insufficienti sul profilo utente in database.';
      case 'permission_denied':
      case 'permission denied':
      case 'auth/permission-denied':
        return 'Permessi database non sufficienti. Verifica le regole Firebase.';
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

