import { computed, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Database, onValue, ref } from '@angular/fire/database';

import { dataIt } from '../../data/language/it';
import { dataEn } from '../../data/language/en';

type LangCode = 'it' | 'en';
type TranslationTree = Record<string, any>;

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly supported: LangCode[] = ['it', 'en'];
  private readonly activeLangStorageKey = 'app.lang.active';
  private readonly bundleStoragePrefix = 'app.lang.bundle.';
  private readonly rtdbBasePath = 'i18n';

  private readonly currentLangSig = signal<LangCode>('it');
  private readonly langRefreshTickSig = signal(0);
  readonly language$ = toObservable(
    computed(() => {
      this.langRefreshTickSig();
      return this.currentLangSig();
    })
  );

  private readonly localFallback: Record<LangCode, TranslationTree> = {
    it: dataIt,
    en: dataEn
  };

  private readonly runtimeBundles: Record<LangCode, TranslationTree> = {
    it: dataIt,
    en: dataEn
  };

  private readonly unsubs: Partial<Record<LangCode, () => void>> = {};

  constructor(private db: Database) {
    this.hydrateBundlesFromLocalStorage();
    const initialLang = this.getStoredActiveLang();
    this.currentLangSig.set(initialLang);
    this.ensureDbSync(initialLang);
  }

  setLanguage(lang: string): void {
    const next = this.normalizeLang(lang);
    this.currentLangSig.set(next);
    this.storeActiveLang(next);
    this.ensureDbSync(next);
  }

  getCurrentLanguage(): LangCode {
    return this.currentLangSig();
  }

  /**
   * Lookup simile a i18n: t('home.hero.headline')
   * Priorita:
   * 1) bundle runtime (DB + cache localStorage + fallback)
   * 2) fallback lingua corrente
   * 3) fallback IT
   * 4) path stesso (missing key)
   */
  t(path: string): string {
    const value = this.get<unknown>(path);
    if (typeof value === 'string') return value;

    console.warn(`[LanguageService] Translation missing: ${path}`);
    return path;
  }

  get<T = unknown>(path: string): T | undefined {
    const lang = this.currentLangSig();
    const fromRuntime = this.getByPath(this.runtimeBundles[lang], path);
    if (fromRuntime !== undefined) return fromRuntime as T;

    const fromFallback = this.getByPath(this.localFallback[lang], path);
    if (fromFallback !== undefined) return fromFallback as T;

    const fromIt = this.getByPath(this.runtimeBundles.it, path) ?? this.getByPath(this.localFallback.it, path);
    if (fromIt !== undefined) return fromIt as T;

    return undefined;
  }

  private ensureDbSync(lang: LangCode): void {
    if (this.unsubs[lang]) return;

    const langRef = ref(this.db, `${this.rtdbBasePath}/${lang}`);
    this.unsubs[lang] = onValue(
      langRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const raw = snapshot.val();
        if (!raw || typeof raw !== 'object') return;

        const merged = this.deepMerge(this.localFallback[lang], raw as TranslationTree);
        this.runtimeBundles[lang] = merged;
        this.storeBundle(lang, merged);

        if (this.currentLangSig() === lang) {
          // Trigger re-render for subscribers when bundles are updated for active language.
          this.langRefreshTickSig.update((value) => value + 1);
        }
      },
      (err) => {
        const code = String((err as any)?.code ?? '');
        const message = String((err as any)?.message ?? '');
        console.warn(`[LanguageService] DB sync failed for "${lang}"`, { code, message });
      }
    );
  }

  private normalizeLang(input: string): LangCode {
    return this.supported.includes(input as LangCode) ? (input as LangCode) : 'it';
  }

  private getStoredActiveLang(): LangCode {
    try {
      const raw = localStorage.getItem(this.activeLangStorageKey) ?? '';
      return this.normalizeLang(raw);
    } catch {
      return 'it';
    }
  }

  private storeActiveLang(lang: LangCode): void {
    try {
      localStorage.setItem(this.activeLangStorageKey, lang);
    } catch {
      // ignore storage write errors
    }
  }

  private bundleKey(lang: LangCode): string {
    return `${this.bundleStoragePrefix}${lang}`;
  }

  private hydrateBundlesFromLocalStorage(): void {
    for (const lang of this.supported) {
      try {
        const raw = localStorage.getItem(this.bundleKey(lang));
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') continue;
        this.runtimeBundles[lang] = this.deepMerge(this.localFallback[lang], parsed as TranslationTree);
      } catch {
        this.runtimeBundles[lang] = this.localFallback[lang];
      }
    }
  }

  private storeBundle(lang: LangCode, bundle: TranslationTree): void {
    try {
      localStorage.setItem(this.bundleKey(lang), JSON.stringify(bundle));
    } catch {
      // ignore storage write errors
    }
  }

  private getByPath(root: TranslationTree, path: string): unknown {
    const segments = String(path ?? '').split('.').filter(Boolean);
    let current: unknown = root;
    for (const segment of segments) {
      if (!current || typeof current !== 'object' || !(segment in (current as Record<string, unknown>))) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    return current;
  }

  private deepMerge(base: TranslationTree, override: TranslationTree): TranslationTree {
    const out: TranslationTree = Array.isArray(base) ? [...base] : { ...base };
    for (const [key, value] of Object.entries(override ?? {})) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        out[key] &&
        typeof out[key] === 'object' &&
        !Array.isArray(out[key])
      ) {
        out[key] = this.deepMerge(out[key] as TranslationTree, value as TranslationTree);
      } else {
        out[key] = value;
      }
    }
    return out;
  }
}
