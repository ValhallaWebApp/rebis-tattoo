import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from '../../../../core/modules/material.module';
import { LanguageService } from '../../../../core/services/language/language.service';
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
  readonly lang = inject(LanguageService);

  readonly ready = this.visibility.ready;
  readonly sections = this.visibility.sections;
  readonly savingKey = signal<string | null>(null);

  async onToggle(sectionKey: string, checked: boolean): Promise<void> {
    this.savingKey.set(sectionKey);
    try {
      await this.visibility.setVisible(sectionKey, checked);
      this.snack.open(this.t('adminSectionsVisibility.feedback.updated'), this.t('adminSectionsVisibility.feedback.ok'), { duration: 1800 });
    } catch {
      this.snack.open(this.t('adminSectionsVisibility.feedback.error'), this.t('adminSectionsVisibility.feedback.ok'), { duration: 2400 });
    } finally {
      this.savingKey.set(null);
    }
  }

  t(path: string): string {
    return this.lang.t(path);
  }
}
