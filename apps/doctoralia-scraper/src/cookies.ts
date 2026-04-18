import fs from "node:fs";

type StoredCookie = { name: string; value: string; domain?: string; path?: string; expires?: number };

export class CookieJar {
  private cookies = new Map<string, StoredCookie>();

  constructor(private readonly filePath: string) {}

  load(): void {
    if (!fs.existsSync(this.filePath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as StoredCookie[];
      const now = Date.now();
      for (const c of raw) {
        if (c.expires && c.expires < now) continue;
        this.cookies.set(c.name, c);
      }
    } catch (err) {
      console.warn("[cookies] failed to load jar:", (err as Error).message);
    }
  }

  save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify([...this.cookies.values()], null, 2), "utf8");
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

  size(): number {
    return this.cookies.size;
  }
}
