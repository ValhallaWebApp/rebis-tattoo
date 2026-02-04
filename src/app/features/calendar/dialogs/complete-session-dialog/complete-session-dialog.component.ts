import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';

export type CompleteSessionDecision = 'healing' | 'new_session' | 'close_project' | 'cancel';

export interface CompleteSessionDialogData {
  projectTitle?: string;
}

@Component({
  selector: 'app-complete-session-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './complete-session-dialog.component.html',
  styleUrls: ['./complete-session-dialog.component.scss'],
})
export class CompleteSessionDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<CompleteSessionDialogComponent, CompleteSessionDecision>,
    @Inject(MAT_DIALOG_DATA) public data: CompleteSessionDialogData
  ) {}

  choose(decision: CompleteSessionDecision) {
    this.dialogRef.close(decision);
  }
}
