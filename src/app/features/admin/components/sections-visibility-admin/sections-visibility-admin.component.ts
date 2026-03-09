import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from '../../../../core/modules/material.module';
import { AdminSectionsVisibilityService } from '../../../../core/services/menu/admin-sections-visibility.service';

@Component({
  selector: 'app-sections-visibility-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './sections-visibility-admin.component.html',
  styleUrl: './sections-visibility-admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SectionsVisibilityAdminComponent {
  private readonly visibility = inject(AdminSectionsVisibilityService);
  private readonly snack = inject(MatSnackBar);

  readonly ready = this.visibility.ready;
  readonly sections = this.visibility.sections;
  readonly savingKey = signal<string | null>(null);

  async onToggle(sectionKey: string, checked: boolean): Promise<void> {
    this.savingKey.set(sectionKey);
    try {
      await this.visibility.setVisible(sectionKey, checked);
      this.snack.open('Visibilita aggiornata', 'OK', { duration: 1800 });
    } catch {
      this.snack.open('Errore durante il salvataggio', 'OK', { duration: 2400 });
    } finally {
      this.savingKey.set(null);
    }
  }
}

