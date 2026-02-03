const BOM_REGEX = /^\uFEFF/;

export function detectDelimiter(line: string): string {
  if (line.includes(";")) return ";";
  if (line.includes("|")) return "|";
  return ",";
}

export function stripBom(value: string): string {
  return value.replace(BOM_REGEX, "");
}
