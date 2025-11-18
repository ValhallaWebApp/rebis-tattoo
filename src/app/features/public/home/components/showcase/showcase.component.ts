import { Component } from '@angular/core';
import { LanguageService } from '../../../../../core/services/language/language.service';

@Component({
  selector: 'app-showcase',
  standalone:false,
  templateUrl: './showcase.component.html',
  styleUrl: './showcase.component.scss'
})
export class ShowcaseComponent {

 constructor(public lang: LanguageService) {
 }
}
