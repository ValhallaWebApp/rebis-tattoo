import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { MaterialModule } from '../../../core/modules/material.module';
import { StaffMember, StaffService } from '../../../core/services/staff/staff.service';
import {
  DEFAULT_STUDIO_PROFILE,
  StudioProfile,
  StudioProfileService,
} from '../../../core/services/studio/studio-profile.service';

@Component({
  standalone: true,
  selector: 'app-chi-siamo',
  imports: [CommonModule, MaterialModule, RouterLink],
  templateUrl: './chi-siamo.component.html',
  styleUrls: ['./chi-siamo.component.scss'],
})
export class ChiSiamoComponent implements OnInit, OnDestroy {
  private readonly staffService = inject(StaffService);
  private readonly studioProfileService = inject(StudioProfileService);

  private staffSub?: Subscription;
  private profileSub?: Subscription;

  profile: StudioProfile = DEFAULT_STUDIO_PROFILE;

  // Team dinamico da Firebase (esclusa la titolare)
  team: StaffMember[] = [];
  activeIndex = 0;

  // swipe
  private pointerDownX: number | null = null;
  private dragging = false;

  ngOnInit(): void {
    this.profileSub = this.studioProfileService.getProfile().subscribe((p) => {
      this.profile = p;
    });

    this.staffSub = this.staffService.getAllStaff().subscribe((staff) => {
      const active = (staff ?? []).filter((m) => m?.isActive !== false);
      const others = active.filter((m) => !this.isOwner(m));

      this.team = others.sort((a, b) => {
        const ra = this.roleOrder(a.role);
        const rb = this.roleOrder(b.role);
        if (ra !== rb) return ra - rb;
        return (a.name ?? '').localeCompare(b.name ?? '');
      });

      if (this.team.length === 0) this.activeIndex = 0;
      else if (this.activeIndex > this.team.length - 1) this.activeIndex = 0;
    });
  }

  ngOnDestroy(): void {
    this.staffSub?.unsubscribe();
    this.profileSub?.unsubscribe();
  }

  get active(): StaffMember | null {
    return this.team?.length ? this.team[this.activeIndex] : null;
  }

  get tattooersCount(): number {
    return this.team.filter((m) => m.role === 'tatuatore').length + 1; // + titolare
  }

  get guestCount(): number {
    return this.team.filter((m) => m.role === 'guest').length;
  }

  trackById = (_: number, item: StaffMember) => item.id ?? item.name ?? _;

  get heroImageUrl(): string {
    return this.profile.ownerPhotoUrl || '/personale/1.jpg';
  }

  getPhoto(m: StaffMember): string {
    const url = (m.photoUrl ?? '').trim();
    return url || this.heroImageUrl;
  }

  roleLabel(role: StaffMember['role']): string {
    switch (role) {
      case 'tatuatore':
        return 'Tatuatore';
      case 'piercer':
        return 'Piercer';
      case 'guest':
        return 'Guest';
      default:
        return 'Staff';
    }
  }

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
    const x = d * 260;
    const s = d === 0 ? 1 : 0.86;
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
    return 10 - d;
  }

  onPointerDown(ev: PointerEvent): void {
    this.pointerDownX = ev.clientX;
    this.dragging = true;
  }

  onPointerMove(_ev: PointerEvent): void {
    if (!this.dragging || this.pointerDownX == null) return;
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

  private isOwner(m: StaffMember): boolean {
    const n = (m?.name ?? '').toLowerCase().trim();
    const owner = (this.profile.ownerName ?? '').toLowerCase().trim();
    return !!owner && n === owner;
  }

  private roleOrder(role: StaffMember['role']): number {
    switch (role) {
      case 'tatuatore':
        return 1;
      case 'piercer':
        return 2;
      case 'guest':
        return 3;
      default:
        return 4;
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
