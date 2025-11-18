import { Injectable, inject } from '@angular/core';
import {
  Database,
  ref,
  push,
  set,
  update,
  remove,
  onValue,
  get,
  query,
  orderByChild,
  equalTo
} from '@angular/fire/database';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface Project {
  id: string;
  dataProgetto: string;
  name: string;
  copertine: string[];
  createAt: string;
  updateAt: string;
  genere: string;
  numeroSedute: number;
  show: boolean;
  note: string;
  utenteCreatore: string;
  artistId: string;
  collaboratori?: string[] | null;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectsService {
  private readonly path = 'projects';
  private db = inject(Database);

  // ✅ CREATE
  async addProject(project: Project): Promise<Project> {
    try {
      const projectRef = push(ref(this.db, this.path));
      const newProject: Project = {
        ...project,
        id: projectRef.key ?? '',
      };
      await set(projectRef, newProject);
      return newProject;
    } catch (error) {
      console.error('Errore creazione progetto:', error);
      throw error;
    }
  }

  // ✅ READ ALL
  getProjects(): Observable<Project[]> {
    return new Observable<Project[]>((observer) => {
      const projectsRef = ref(this.db, this.path);
      onValue(projectsRef, (snapshot) => {
        const data = snapshot.val();
        const projects: Project[] = data
          ? Object.entries(data).map(([key, value]: any) => ({ id: key, ...value }))
          : [];
        observer.next(projects);
      });
    });
  }

  // ✅ READ BY ID
  async getProjectById(id: string): Promise<Project | null> {
    try {
      const snapshot = await get(ref(this.db, `${this.path}/${id}`));
      return snapshot.exists() ? { id, ...snapshot.val() } : null;
    } catch (error) {
      console.error('Errore recupero progetto:', error);
      return null;
    }
  }

  // ✅ UPDATE
  async updateProject(id: string, updatedData: Partial<Project>): Promise<void> {
    try {
      await update(ref(this.db, `${this.path}/${id}`), updatedData);
    } catch (error) {
      console.error('Errore aggiornamento progetto:', error);
      throw error;
    }
  }

  // ✅ DELETE
  async deleteProject(id: string): Promise<void> {
    try {
      await remove(ref(this.db, `${this.path}/${id}`));
    } catch (error) {
      console.error('Errore eliminazione progetto:', error);
      throw error;
    }
  }

  // ✅ QUERY: Per artista
  findProjectsByArtist(artistId: string): Observable<Project[]> {
    return new Observable<Project[]>((observer) => {
      const projectQuery = query(
        ref(this.db, this.path),
        orderByChild('artistId'),
        equalTo(artistId)
      );
      onValue(projectQuery, (snapshot) => {
        const data = snapshot.val();
        const projects: Project[] = data
          ? Object.entries(data).map(([key, value]: any) => ({ id: key, ...value }))
          : [];
        observer.next(projects);
      });
    });
  }

  // ✅ EXISTS CHECK
  async hasProject(projectId: string): Promise<boolean> {
    try {
      const snapshot = await get(ref(this.db, `${this.path}/${projectId}`));
      return snapshot.exists();
    } catch (error) {
      console.error('Errore verifica progetto:', error);
      return false;
    }
  }
}
