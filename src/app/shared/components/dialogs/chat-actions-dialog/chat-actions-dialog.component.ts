import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../core/modules/material.module';

@Component({
  selector: 'app-chat-actions-dialog',
  standalone: true,
  templateUrl: './chat-actions-dialog.component.html',
  styleUrls: ['./chat-actions-dialog.component.scss'],
  imports: [CommonModule, MaterialModule, ReactiveFormsModule]
})
export class ChatActionsDialogComponent {
 confirmDelete = false;
  noteCtrl = new FormControl<string>('', { nonNullable: true });
  showNoteInput = false;

  constructor(
    public dialogRef: MatDialogRef<ChatActionsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { status: 'aperto' | 'chiuso' }
  ) {}

  confirm(action: 'delete' | 'close' | 'reopen') {
    this.dialogRef.close({ action, note: this.noteCtrl.value.trim() });
  }

  cancel() {
    this.dialogRef.close();
  }
}
