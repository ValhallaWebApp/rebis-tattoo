import {
  Component,
  ElementRef,
  AfterViewInit,
  ViewChild,
  OnDestroy,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-tattoo-avatar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="avatar-wrapper">
      <canvas #canvas></canvas>
      <div class="controls">
        <input type="file" accept="image/*" (change)="onTattooUpload($event)" />
        <label>Scale
          <input type="range" min="0.05" max="0.5" step="0.01" [(ngModel)]="decalScale" />
        </label>
        <label>Rotation
          <input type="range" min="0" max="360" step="1" [(ngModel)]="decalRotation" />°
        </label>
        <button (click)="clearTattoos()">Reset</button>
      </div>
    </div>
  `,
  styles: [`
    .avatar-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      min-width:100vw;
      min-height:400px;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    .controls {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: rgba(0,0,0,0.6);
      color: #fff;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      font-size: 0.85rem;
    }
    input[type="range"] {
      width: 120px;
    }
  `]
})
export class TattooAvatarComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private avatar!: THREE.Object3D;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private tattooMaterial?: THREE.MeshBasicMaterial;
  private animationId?: number;

  // user‑controlled decal parameters
  decalScale = 0.15;
  decalRotation = 0;

  // === life‑cycle ========================================================
  ngAfterViewInit(): void {
    this.initThree();
    this.loadAvatar('assets/models/avatar.glb');
    this.animate();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId!);
    this.controls.dispose();
    this.renderer.dispose();
  }

  // === three.js setup ====================================================
  private initThree(): void {
    const canvas = this.canvasRef.nativeElement;
    const { clientWidth: w, clientHeight: h } = canvas.parentElement!;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222222);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 1.6, 3);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(devicePixelRatio);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;

    const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.scene.add(light);
  }

  private loadAvatar(path: string): void {
    const loader = new GLTFLoader();
    loader.load(
      path,
      gltf => {
        this.avatar = gltf.scene;
        this.avatar.traverse(obj => {
          if ((obj as THREE.Mesh).isMesh) {
            (obj as THREE.Mesh).castShadow = true;
            (obj as THREE.Mesh).receiveShadow = true;
          }
        });
        this.scene.add(this.avatar);
      },
      undefined,
      err => console.error('Avatar load error:', err)
    );
  }

  // === user interactions ===============================================
  @HostListener('window:resize') onResize() {
    const canvas = this.canvasRef.nativeElement;
    const { clientWidth: w, clientHeight: h } = canvas.parentElement!;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    if (!this.tattooMaterial || !this.avatar) return;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObject(this.avatar, true);
    if (intersects.length === 0) return;

    const { point, face, object } = intersects[0];
    const normal = face?.normal.clone().transformDirection(object.matrixWorld);
    const orientation = new THREE.Euler(0, 0, THREE.MathUtils.degToRad(this.decalRotation));

    const decalGeometry = new DecalGeometry(
      object as THREE.Mesh,
      point,
      orientation,
      new THREE.Vector3(this.decalScale, this.decalScale, this.decalScale)
    );

    const decalMesh = new THREE.Mesh(decalGeometry, this.tattooMaterial);
    this.scene.add(decalMesh);
  }

  onTattooUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      const texture = new THREE.TextureLoader().load(e.target!.result as string, () => {
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        this.tattooMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
      });
    };
    reader.readAsDataURL(file);
  }

  clearTattoos(): void {
    // remove all decal meshes (they are added directly to scene)
    this.scene.children.filter(obj => obj.userData?.['isDecal']).forEach(obj => this.scene.remove(obj));
  }

  // === render loop =======================================================
  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
