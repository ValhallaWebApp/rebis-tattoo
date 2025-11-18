import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

import { dataIt } from '../../data/language/it';
import { dataEn } from '../../data/language/en';
type LangCode = 'it' | 'en';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private currentLang$ = new BehaviorSubject<LangCode>('it');

  private localFallback: Record<LangCode, any> = {
    it: dataIt,
    en: dataEn
  };

  /**
   * Cambia lingua attiva
   */
  setLanguage(lang: string) {
    const supported: LangCode[] = ['it', 'en'];
    this.currentLang$.next(supported.includes(lang as LangCode) ? (lang as LangCode) : 'it');
  }

  /**
   * Metodo simile a i18n: t('home.hero.headline')
   */
  t(path: string): string {
    const lang = this.currentLang$.getValue();
    const segments = path.split('.');
    let result: any = this.localFallback[lang];

    for (const segment of segments) {
      if (result && segment in result) {
        result = result[segment];
      } else {
        console.warn(`Translation missing: ${path}`);
        return path;
      }
    }

    return typeof result === 'string' ? result : path;
  }
}
