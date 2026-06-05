// Shape común que todo adapter de ATS normaliza. El service consume RawJob[]
// y no necesita saber de qué portal vino.

export interface RawJob {
  source: string; // "teamtailor"
  company: string; // subdominio/empresa
  externalId: string; // id del job en el ATS
  title: string;
  url: string;
  department: string | null;
  location: string | null;
  remote: string | null;
  descriptionHtml: string | null;
  publishedAt: Date | null;
  lastmod: Date | null;
  raw: unknown;
}
