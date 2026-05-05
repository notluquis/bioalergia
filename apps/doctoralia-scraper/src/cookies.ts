type StoredCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
};

type CookieJarOptions = {
  endpoint: string;
  apiToken: string;
  label: string;
};

export class CookieJar {
  private cookies = new Map<string, StoredCookie>();
  private lastFetchedSnapshot: string | null = null;

  constructor(private readonly options: CookieJarOptions) {}

  async load(): Promise<void> {
    const url = new URL(this.options.endpoint);
    url.searchParams.set("label", this.options.label);

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${this.options.apiToken}` },
      });
    } catch (err) {
      throw new Error(`[cookies] failed to reach ${url}: ${(err as Error).message}`);
    }

    if (res.status === 404) {
      console.warn(`[cookies] no stored cookies for label="${this.options.label}" — paste them from the intranet panel first`);
      return;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`[cookies] GET ${url} → ${res.status}: ${body.slice(0, 200)}`);
    }

    const payload = (await res.json()) as { cookies?: StoredCookie[] };
    const list = Array.isArray(payload.cookies) ? payload.cookies : [];
    const now = Date.now();
    for (const c of list) {
      if (c.expires && c.expires < now) continue;
      this.cookies.set(c.name, c);
    }
    this.lastFetchedSnapshot = this.snapshot();
  }

  async save(): Promise<void> {
    const current = this.snapshot();
    if (current === this.lastFetchedSnapshot) return;

    const body = JSON.stringify({
      label: this.options.label,
      cookies: [...this.cookies.values()],
    });

    const res = await fetch(this.options.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiToken}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[cookies] POST ${this.options.endpoint} → ${res.status}: ${text.slice(0, 200)}`);
    }

    this.lastFetchedSnapshot = current;
  }

  ingestSetCookie(headerValues: string[]): void {
    for (const raw of headerValues) {
      const parts = raw.split(";").map((p) => p.trim());
      const first = parts[0];
      if (!first) continue;
      const eq = first.indexOf("=");
      if (eq < 0) continue;
      const name = first.slice(0, eq).trim();
      const value = first.slice(eq + 1).trim();
      const attrs: Record<string, string> = {};
      for (const p of parts.slice(1)) {
        const [k, v] = p.split("=", 2);
        if (k) attrs[k.toLowerCase()] = (v ?? "").trim();
      }
      if (attrs["max-age"] === "0" || value === "") {
        this.cookies.delete(name);
        continue;
      }
      let expires: number | undefined;
      if (attrs["max-age"]) expires = Date.now() + Number(attrs["max-age"]) * 1000;
      else if (attrs.expires) expires = Date.parse(attrs.expires) || undefined;
      this.cookies.set(name, { name, value, domain: attrs.domain, path: attrs.path, expires });
    }
  }

  header(): string {
    return [...this.cookies.values()].map((c) => `${c.name}=${c.value}`).join("; ");
  }

  get(name: string): string | undefined {
    return this.cookies.get(name)?.value;
  }

  clear(): void {
    this.cookies.clear();
  }

  setRaw(name: string, value: string, domain?: string, path?: string, expiresMs?: number): void {
    this.cookies.set(name, { name, value, domain, path, expires: expiresMs });
  }

  size(): number {
    return this.cookies.size;
  }

  private snapshot(): string {
    return JSON.stringify([...this.cookies.values()].sort((a, b) => a.name.localeCompare(b.name)));
  }
}
