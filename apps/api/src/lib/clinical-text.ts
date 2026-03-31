import { parseFragment, type DefaultTreeAdapterMap } from "parse5";

type HtmlNode = DefaultTreeAdapterMap["node"];
type HtmlParentNode = DefaultTreeAdapterMap["parentNode"];

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}

function htmlNodeHasChildren(node: HtmlNode): node is HtmlParentNode {
  return "childNodes" in node && Array.isArray(node.childNodes);
}

function htmlNodeTagName(node: HtmlNode): null | string {
  return "tagName" in node && typeof node.tagName === "string" ? node.tagName.toLowerCase() : null;
}

function collectClinicalTextFromHtml(node: HtmlNode, parts: string[]): void {
  if ("value" in node && typeof node.value === "string") {
    parts.push(node.value);
    return;
  }

  const tagName = htmlNodeTagName(node);
  const startsBlock =
    tagName === "br" ||
    tagName === "div" ||
    tagName === "li" ||
    tagName === "p" ||
    tagName === "tr";
  if (startsBlock) parts.push("\n");

  if (htmlNodeHasChildren(node)) {
    for (const child of node.childNodes) {
      collectClinicalTextFromHtml(child, parts);
    }
  }

  const endsBlock =
    tagName === "div" ||
    tagName === "li" ||
    tagName === "p" ||
    tagName === "td" ||
    tagName === "th" ||
    tagName === "tr";
  if (endsBlock) parts.push("\n");
}

export function normalizeClinicalText(value: null | string | undefined): string {
  if (!value) return "";
  const decoded = decodeBasicHtmlEntities(value);
  const parts: string[] = [];
  collectClinicalTextFromHtml(parseFragment(decoded), parts);
  return parts
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function joinClinicalText(
  summary: null | string | undefined,
  description: null | string | undefined,
  separator = " ",
): string {
  const summaryText = normalizeClinicalText(summary);
  const descriptionText = normalizeClinicalText(description);
  return [summaryText, descriptionText].filter(Boolean).join(separator).trim();
}

export function normalizeClinicalTextLower(value: null | string | undefined): string {
  return normalizeClinicalText(value).toLowerCase();
}
