import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { MaterialModule } from '../../../core/modules/material.module';
import { StaffMember, StaffService } from '../../../core/services/staff/staff.service';

interface StaticSara {
  name: string;
  roleLabel: string;
  bio: string;
  photoUrl: string;
}

@Component({
  standalone: true,
  selector: 'app-chi-siamo',
  imports: [CommonModule, MaterialModule],
  templateUrl: './chi-siamo.component.html',
  styleUrls: ['./chi-siamo.component.scss'],
})
export class ChiSiamoComponent implements OnInit, OnDestroy {
  private readonly staffService = inject(StaffService);
  private sub?: Subscription;

  // ✅ HERO Titolare (statica)
  sara: StaticSara = {
    name: 'Sara Pushi',
    roleLabel: 'Tatuatrice · Titolare',
    bio:
      'Rebis Tattoo nasce da una visione precisa: pochi progetti, curati davvero. ' +
      'Ogni tatuaggio viene seguito personalmente dalla consulenza alla guarigione, ' +
      'con attenzione al posizionamento, alle linee e alla durata nel tempo.',
    // metti qui l’immagine reale che hai in assets
    photoUrl: 'assets/personale/sara.jpg',
  };

  // ✅ Team dinamico da Firebase (esclusa Sara)
  team: StaffMember[] = [];
  activeIndex = 0;

  // fallback immagini per staff
  readonly heroImageUrl = '/personale/1.jpg';

  // swipe
  private pointerDownX: number | null = null;
  private dragging = false;

  ngOnInit(): void {
    this.sub = this.staffService.getAllStaff().subscribe((staff) => {
      const active = (staff ?? []).filter((m) => m?.isActive !== false);

      // escludo Sara dal feed dinamico (perché la mostriamo statica)
      const others = active.filter((m) => !this.isSara(m));

      // ordina: tatuatore/piercer/guest/altro + nome
      this.team = others.sort((a, b) => {
        const ra = this.roleOrder(a.role);
        const rb = this.roleOrder(b.role);
        if (ra !== rb) return ra - rb;
        return (a.name ?? '').localeCompare(b.name ?? '');
      });

      // safety: se cambia la lista, mantengo index valido
      if (this.team.length === 0) this.activeIndex = 0;
      else if (this.activeIndex > this.team.length - 1) this.activeIndex = 0;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ====== Template helpers ======

  get active(): StaffMember | null {
    return this.team?.length ? this.team[this.activeIndex] : null;
  }

  trackById = (_: number, item: StaffMember) => item.id ?? item.name ?? _;

  getPhoto(m: StaffMember): string {
    const url = (m.photoUrl ?? '').trim();
    return url || this.heroImageUrl;
  }

  roleLabel(role: StaffMember['role']): string {
    switch (role) {
      case 'tatuatore': return 'Tatuatore';
      case 'piercer': return 'Piercer';
      case 'guest': return 'Guest';
      default: return 'Staff';
    }
  }

  // ====== Carousel controls ======

  prev(): void {
    if (!this.team?.length) return;
    this.activeIndex = (this.activeIndex - 1 + this.team.length) % this.team.length;
  }

  next(): void {
    if (!this.team?.length) return;
    this.activeIndex = (this.activeIndex + 1) % this.team.length;
  }

  setActive(i: number): void {
    if (!this.team?.length) return;
    this.activeIndex = i;
  }

  // mostra solo centro + 2 lati
  isHidden(i: number): boolean {
    if (!this.team?.length) return true;
    const d = this.circularDistance(this.activeIndex, i);
    return Math.abs(d) > 1;
  }

  isLeft(i: number): boolean {
    return this.circularDistance(this.activeIndex, i) === -1;
  }

  isRight(i: number): boolean {
    return this.circularDistance(this.activeIndex, i) === 1;
  }

  getTransform(i: number): string {
    if (!this.team?.length) return 'translateX(0) scale(1)';
    const d = this.circularDistance(this.activeIndex, i);

    const x = d * 260;             // distanza laterale
    const s = d === 0 ? 1 : 0.86;  // scale

    return `translateX(${x}px) scale(${s})`;
  }

  getOpacity(i: number): number {
    if (!this.team?.length) return 0;
    const d = this.circularDistance(this.activeIndex, i);
    if (Math.abs(d) > 1) return 0;
    return d === 0 ? 1 : 0.62;
  }

  getZIndex(i: number): number {
    if (!this.team?.length) return 0;
    const d = Math.abs(this.circularDistance(this.activeIndex, i));
    return 10 - d; // centro sopra
  }

  // ====== Swipe (Pointer Events) ======

  onPointerDown(ev: PointerEvent): void {
    this.pointerDownX = ev.clientX;
    this.dragging = true;
  }

  onPointerMove(_ev: PointerEvent): void {
    if (!this.dragging || this.pointerDownX == null) return;
    // volutamente no drag live: swipe semplice e pulito
  }

  onPointerUp(ev: PointerEvent): void {
    if (!this.dragging || this.pointerDownX == null) return;

    const dx = ev.clientX - this.pointerDownX;
    const threshold = 45;

    this.dragging = false;
    this.pointerDownX = null;

    if (dx > threshold) this.prev();
    else if (dx < -threshold) this.next();
  }

  // ====== Private helpers ======

  private isSara(m: StaffMember): boolean {
    const n = (m?.name ?? '').toLowerCase().trim();
    // escludi Sara in modo robusto
    return n === 'sara' || n.includes('sara push') || n.includes('sara p');
  }

  private roleOrder(role: StaffMember['role']): number {
    switch (role) {
      case 'tatuatore': return 1;
      case 'piercer': return 2;
      case 'guest': return 3;
      default: return 4;
    }
  }

  private circularDistance(from: number, to: number): number {
    const n = this.team.length;
    let d = to - from;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  }
}
