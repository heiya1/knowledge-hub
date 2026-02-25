export interface DocumentMeta {
  id: string;
  title: string;
  parent: string | null;
  order: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Document extends DocumentMeta {
  body: string;
}
