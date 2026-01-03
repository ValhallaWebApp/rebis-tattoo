import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { FastBookingLayoutComponent } from '../../ui/fast-booking-layout/fast-booking-layout.component';
import { StepArtistComponent } from '../../steps/step-artist/step-artist.component';
import { FastBookingStore } from '../../state/fast-booking-store.service';
import { MaterialModule } from '../../../../../core/modules/material.module';
import { StepIntroComponent } from "../../steps/step-intro/step-intro.component";
import { StepWhenComponent } from '../../steps/step-when/step-when.component';
import { StepDetailsComponent } from '../../steps/step-details/step-details.component';
import { StepSummaryComponent } from '../../steps/step-summary/step-summary.component';
import { StepPaymentComponent } from "../../steps/step-payment/step-payment.component";
import { StepSuccessComponent } from "../../steps/step-success/step-success.component";

@Component({
  selector: 'app-fast-booking-page',
  standalone: true,
  imports: [
    CommonModule,
    MaterialModule,
    FastBookingLayoutComponent,
    StepArtistComponent,
    StepIntroComponent,
    StepWhenComponent,
    StepDetailsComponent,
    StepSummaryComponent,
    StepPaymentComponent,
    StepSuccessComponent
],
  templateUrl: './fast-booking-page.component.html',
  styleUrl: './fast-booking-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FastBookingPageComponent {
  private readonly store = inject(FastBookingStore);

  readonly step = this.store.step;
  readonly progress = this.store.progress;
  readonly canBack = this.store.canBack;
  readonly canNext = this.store.canNext;

  back() { this.store.back(); }
  next() { this.store.next(); }
}
