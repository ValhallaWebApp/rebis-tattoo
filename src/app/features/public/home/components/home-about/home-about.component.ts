import { Component } from '@angular/core';
import { LanguageService } from '../../../../../core/services/language/language.service';

@Component({
  selector: 'app-home-about',
  standalone:false,
  templateUrl: './home-about.component.html',
  styleUrl: './home-about.component.scss'
})
export class HomeAboutComponent {
  constructor(public lang: LanguageService) {}

}
