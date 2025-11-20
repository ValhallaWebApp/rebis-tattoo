export interface TattooService {
  id: string;
  title: string;
  description?: string;
  price: number;
  duration: number; // in minutes
  isVisible: boolean;
}
