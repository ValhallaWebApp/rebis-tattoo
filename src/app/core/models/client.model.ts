export interface Client {
  id: string;
  displayName: string;
  email: string;
  phone?: string;
  instagram?: string;
  createdAt: string;
  referredBy?: string;
}
