import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LanguageService } from '../../../../../core/services/language/language.service';

@Component({
  selector: 'app-home-hero',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-hero.component.html',
  styleUrls: ['./home-hero.component.scss']
})
export class HomeHeroComponent {
  constructor(public lang: LanguageService) {
    // Debug opzionale
    console.log(this.lang.t('home.hero.cta'));
  }
}

