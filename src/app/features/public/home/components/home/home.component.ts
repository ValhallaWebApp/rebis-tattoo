import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DEFAULT_STUDIO_PROFILE, StudioProfileService } from '../../../../../core/services/studio/studio-profile.service';

@Component({
  selector: 'app-home',
  standalone:false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  private readonly studioProfile = inject(StudioProfileService);
  private readonly profileSig = toSignal(this.studioProfile.getProfile(), {
    initialValue: DEFAULT_STUDIO_PROFILE
  });
  readonly homeBackgroundUrl = computed(() => String(this.profileSig().homeBackgroundImageUrl ?? '').trim());
}
