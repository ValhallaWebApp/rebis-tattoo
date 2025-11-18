import { Component, ElementRef, ViewChild, inject, effect, Injector, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../../core/modules/material.module';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../../core/services/auth/authservice';
import {  ChatMessage, ChatService } from '../../../../core/services/chatBot/chat-bot.service';

type Thread = any; // compat

@Component({
  selector: 'app-messaging',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, ReactiveFormsModule, PickerModule],
  templateUrl: './messaging.component.html',
  styleUrls: ['./messaging.component.scss']
})
export class MessagingComponent {
  // services + injector per effect (no NG0203)
  private readonly auth = inject(AuthService);
  private readonly chat = inject(ChatService);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);

  // UI state
  isDesktop = window.innerWidth >= 768;
  sidebarOpen = false;
  emojiPickerVisible = false;
  galleryOpen = false;
  expandedImage: string | null = null;

  // filtro e search
  statusFilter = signal<'aperte' | 'chiuse' | 'tutte'>('aperte');
  searchCtrl = new FormControl<string>('', { nonNullable: true });

  // dati
  threads = signal<Thread[]>([]);
  selectedThread = signal<Thread | null>(null);
  messages = signal<ChatMessage[]>([]);
  newMessage = '';

  // derived
  filteredThreads = computed(() => {
    const q = (this.searchCtrl.value || '').toLowerCase();
    const mode = this.statusFilter();
    return this.threads().filter(t => {
      const matchesStatus =
        mode === 'tutte' ? true :
        mode === 'aperte' ? (t.status || 'aperto') === 'aperto' :
                            (t.status || 'aperto') === 'chiuso';
      const lastText = t.summary || '';
      const matchesQuery = !q || t.id?.toLowerCase().includes(q) || lastText.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  });

  // emoji categories, media mock (come prima)
  emojiCategories: any[] = ['smileys', 'foods', 'activities', 'objects'];
  projectImages: string[] = []; // riempita da updateGallery()

  // effect: reagisce all'utente loggato e carica le chat
  private readonly dataEffect = effect((onCleanup) => {
    const u = this.auth.userSig();
    if (!u?.uid) return;

    // const sub = this.chat.getChatsByClient(u.uid).subscribe(list => {
      // this.threads.set(list);
      // selezione automatica: prima aperta, altrimenti prima disponibile
      const current = this.selectedThread();
      // if (!current || !list.some(t => t.id === current.id)) {
      //   const firstOpen = list.find(t => (t.status || 'aperto') === 'aperto');
      //   this.selectThread(firstOpen || list[0] || null);
      // }
    });

  //   onCleanup(() => sub.unsubscribe());
  // }, { injector: this.injector });

  constructor() {
    // resize listener minimale
    window.addEventListener('resize', () => this.isDesktop = window.innerWidth >= 768);
  }

  // selezione thread → subscribe messaggi realtime
  @ViewChild('msgBox') msgBox!: ElementRef<HTMLDivElement>;

  selectThread(t: Thread | null) {
    this.selectedThread.set(t);
    this.messages.set([]);
    if (!t?.id) return;

    const sub = this.chat.getMessages(t.id).subscribe(msgs => {
      this.messages.set(msgs);
      setTimeout(() => this.scrollBottom(), 0);
      this.updateGallery();
    });

    // quando cambio thread, pulisco la sub precedente
    // (usiamo un trick: metto la sub in un campo della funzione per poterla chiudere)
    (this.selectThread as any)._sub?.unsubscribe?.();
    (this.selectThread as any)._sub = sub;
  }

  // invio testo
  async sendMessage(): Promise<void> {
    const text = this.newMessage.trim();
    const t = this.selectedThread();
    if (!text || !t?.id) return;

    await this.chat.addMessage(t.id, { from: 'user', text, timestamp: '', chips: null });
    this.newMessage = '';
    this.emojiPickerVisible = false;
  }

  // upload immagine (come prima, ma persistente se vuoi – qui blob URL locale)
  uploadMedia(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    const t = this.selectedThread();
    if (!file || !t?.id) return;
    const url = URL.createObjectURL(file);
    this.chat.addMessage(t.id, { from: 'user', text: '', timestamp: '', chips: null }).then(async (msgId) => {
      // se hai storage, qui salvi realmente l’immagine e metti l’url definitivo
      // per ora, aggiungiamo un messaggio testuale con link
      await this.chat.addMessage(t.id, { from: 'user', text: `📎 Media: ${url}`, timestamp: '', chips: null });
    });
  }

  // chiudi/riapri/elimina
  async startCloseThread() {
    // mostra input nota come facevi già nel TS, oppure dialog rapido
    // qui, per brevità, chiudo senza nota
    await this.setStatus('chiuso');
  }
  async setStatus(status: any, note?: string) {
    const t = this.selectedThread();
    if (!t?.id) return;
    // await this.chat.setChatStatus(t.id, status, note);
    // aggiorna selezione se hai filtrato “aperte”
    if (status === 'chiuso' && this.statusFilter() === 'aperte') {
      const next = this.filteredThreads()[0] || null;
      this.selectThread(next);
    }
  }
  async deleteThread() {
    const t = this.selectedThread();
    if (!t?.id) return;
    // await this.chat.deleteChat(t.id);
    this.selectThread(null);
  }

  // utility UI
  addEmoji(e: any) { this.newMessage += e.emoji.native; this.emojiPickerVisible = false; }
  hasGallery(): boolean { return this.messages().some(m => /https?:\/\/.+\.(png|jpe?g|webp|gif)/i.test(m.text)); }
  openGallery() { this.updateGallery(); this.galleryOpen = true; }
  toggleExpand(img: string) { this.expandedImage = this.expandedImage === img ? null : img; }
  private scrollBottom() {
    const el = this.msgBox?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
  private updateGallery() {
    this.projectImages = this.messages()
      .map(m => {
        const mUrl = m.text?.match(/https?:\/\/\S+\.(?:png|jpe?g|webp|gif)/i)?.[0];
        return mUrl || null;
      })
      .filter(Boolean) as string[];
  }
}
