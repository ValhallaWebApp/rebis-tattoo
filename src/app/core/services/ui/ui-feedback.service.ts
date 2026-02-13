import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

type FeedbackTone = 'success' | 'error' | 'info' | 'warn';

@Injectable({ providedIn: 'root' })
export class UiFeedbackService {
  private readonly snackBar = inject(MatSnackBar);

  open(message: string, action = 'OK', config?: MatSnackBarConfig): void {
    this.snackBar.open(message, action, config);
  }

  success(message: string, action = 'OK', duration = 2600): void {
    this.openTone(message, 'success', action, duration);
  }

  error(message: string, action = 'Chiudi', duration = 3600): void {
    this.openTone(message, 'error', action, duration);
  }

  info(message: string, action = 'OK', duration = 2400): void {
    this.openTone(message, 'info', action, duration);
  }

  warn(message: string, action = 'OK', duration = 3000): void {
    this.openTone(message, 'warn', action, duration);
  }

  private openTone(
    message: string,
    tone: FeedbackTone,
    action: string,
    duration: number
  ): void {
    const config: MatSnackBarConfig = {
      duration,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['app-snackbar', `app-snackbar-${tone}`]
    };

    this.snackBar.open(message, action, config);
  }
}
