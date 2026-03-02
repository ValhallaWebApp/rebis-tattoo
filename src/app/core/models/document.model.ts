import { Timestamped } from './common.model';

export interface StudioDocument extends Timestamped {
  id?: string;
  title: string;
  description: string;
  fileUrl: string;
}

export type StudioDocumentUpsert = Pick<StudioDocument, 'title' | 'description' | 'fileUrl'>;
