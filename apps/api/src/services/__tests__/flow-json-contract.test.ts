import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Contract test: the Flow JSON (what Meta renders + posts) and the mapper (what
// the endpoint reads) share an implicit key contract. A renamed Flow field would
// silently drop data on submit — the mapper would read `undefined` for the old
// key. This test fails loudly if either side drifts.

type FlowNode = {
  type?: string;
  name?: string;
  children?: FlowNode[];
  then?: FlowNode[];
  "on-click-action"?: { name?: string; payload?: Record<string, unknown> };
};

const flowJson = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../../../docs/wa-flow-intake/flow.json", import.meta.url)),
    "utf8"
  )
) as {
  screens: Array<{ id: string; layout: { children: FlowNode[] }; data?: Record<string, unknown> }>;
};

const intakeSource = readFileSync(
  fileURLToPath(new URL("../intake.ts", import.meta.url)),
  "utf8"
);

// The keys mapFlowDataToIntake actually reads, extracted from the function body
// (single source of truth — catches drift on the MAPPER side too).
function mapperKeys(): Set<string> {
  const start = intakeSource.indexOf("export function mapFlowDataToIntake");
  expect(start).toBeGreaterThanOrEqual(0);
  const after = intakeSource.indexOf("\nexport ", start + 1);
  const body = intakeSource.slice(start, after === -1 ? undefined : after);
  const keys = new Set<string>();
  for (const m of body.matchAll(/\bdata\.(\w+)/g)) keys.add(m[1]);
  return keys;
}

// Field-input node types on the FICHA form (things a patient fills in). Excludes
// structural nodes (Form/Footer/If/TextBody) and the PhotoPicker (COMPROBANTE).
const FIELD_TYPES = new Set(["TextInput", "TextArea", "DatePicker", "Dropdown"]);

function collectFieldNames(nodes: FlowNode[], out: Set<string>): void {
  for (const node of nodes) {
    if (node.type && FIELD_TYPES.has(node.type) && node.name) out.add(node.name);
    if (node.children) collectFieldNames(node.children, out);
    if (node.then) collectFieldNames(node.then, out); // If.then branch (tutor_*)
  }
}

function screen(id: string) {
  const s = flowJson.screens.find((x) => x.id === id);
  if (!s) throw new Error(`screen ${id} not found`);
  return s;
}

function findDataExchangePayload(nodes: FlowNode[]): Record<string, unknown> | null {
  for (const node of nodes) {
    const action = node["on-click-action"];
    if (action?.name === "data_exchange" && action.payload) return action.payload;
    const child =
      (node.children && findDataExchangePayload(node.children)) ||
      (node.then && findDataExchangePayload(node.then));
    if (child) return child;
  }
  return null;
}

const sorted = (s: Iterable<string>) => [...s].sort();

describe("flow.json ↔ mapFlowDataToIntake contract", () => {
  const MAPPER = mapperKeys();

  it("mapper reads exactly the documented 17 form keys", () => {
    // Guard the extraction itself — if this list changes, the contract changed.
    expect(sorted(MAPPER)).toEqual([
      "alergias",
      "condiciones",
      "correo",
      "direccion",
      "es_menor",
      "fecha_nacimiento",
      "isapre",
      "medicamentos",
      "motivo",
      "nombre",
      "prevision",
      "rut",
      "telefono",
      "tutor_nombre",
      "tutor_relacion",
      "tutor_rut",
      "tutor_telefono",
    ]);
  });

  it("every FICHA form field name is a key the mapper reads (and vice-versa)", () => {
    const fichaFields = new Set<string>();
    collectFieldNames(screen("FICHA").layout.children, fichaFields);
    expect(sorted(fichaFields)).toEqual(sorted(MAPPER));
  });

  it("the final data_exchange payload keys = mapper keys + comprobante", () => {
    const payload = findDataExchangePayload(screen("COMPROBANTE").layout.children);
    expect(payload).not.toBeNull();
    const payloadKeys = new Set(Object.keys(payload as Record<string, unknown>));
    expect(sorted(payloadKeys)).toEqual(sorted(new Set([...MAPPER, "comprobante"])));
  });

  it("the PhotoPicker value is a TOP-LEVEL payload key (Meta requirement + extractFlowPhoto scans top-level)", () => {
    // PhotoPicker declared with name "comprobante".
    const photoPickers: string[] = [];
    (function walk(nodes: FlowNode[]) {
      for (const n of nodes) {
        if (n.type === "PhotoPicker" && n.name) photoPickers.push(n.name);
        if (n.children) walk(n.children);
        if (n.then) walk(n.then);
      }
    })(screen("COMPROBANTE").layout.children);
    expect(photoPickers).toEqual(["comprobante"]);

    const payload = findDataExchangePayload(screen("COMPROBANTE").layout.children) ?? {};
    // Top-level key (not nested under another object) referencing the picker.
    expect(Object.hasOwn(payload, "comprobante")).toBe(true);
    expect(payload.comprobante).toBe("${form.comprobante}");
  });
});
