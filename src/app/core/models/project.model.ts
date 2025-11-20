export interface Project {
  id: string;
  title: string;
  description?: string;
  clientId: string;
  artistIds: string[];
  imageUrls?: string[];
  createdAt: string;
}
