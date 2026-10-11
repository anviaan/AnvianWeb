export interface Source {
  url: string;
  downloads: number;
  updatedAt: string;
  stale: boolean;
}
export interface Project {
  id: string;
  name: string;
  description: string;
  type: string;
  icon: string | null;
  image: string | null;
  github: string | null;
  featured: boolean;
  archived?: boolean;
  sources: Record<string, Source>;
  platformLinks?: Record<string, string>;
  expectedSources: string[];
  reportedDownloads?: { value: number; stale: boolean; partial: boolean };
}
