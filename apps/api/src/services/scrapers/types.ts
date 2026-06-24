// Tipos compartidos para scrapers de utility/service providers.
// Cada scraper post-login implementa esta interface.

export interface ScraperBillResult {
  accountNumber: string;
  address: null | string;
  clientName: null | string;
  currentAmount: number;
  currentDebt: null | number;
  dueDate: null | string;
  emissionDate: null | string;
  lastPayment: { amount: number; date: string } | null;
  observation: null | string;
  previousAmount: null | number;
  raw: unknown;
  thirdAmount: null | number;
}

export interface ScraperCredentials {
  identifier: string;
  metadata?: Record<string, unknown>;
  secret: string;
}

export interface ScraperContext {
  cookieJar?: Record<string, string>;
  credentials: ScraperCredentials;
  serviceNumber?: string;
}
