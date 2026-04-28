/**
 * Google Ads conversion tracking helper.
 * Conversion ID: AW-360676950
 *
 * To add conversion labels, create conversion actions in Google Ads:
 * Tools → Conversions → + New conversion action → Website
 * Then update the labels below.
 */

const CONVERSION_ID = "AW-360676950";

// Update these labels after creating conversion actions in Google Ads
const CONVERSION_LABELS = {
  doctoralia_booking: "", // e.g. "AbCdEfGhIjKl"
  whatsapp_click: "",
  email_click: "",
  phone_click: "",
} as const;

type ConversionAction = keyof typeof CONVERSION_LABELS;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackConversion(action: ConversionAction, value?: number) {
  const label = CONVERSION_LABELS[action];
  if (!label || !window.gtag) return;

  window.gtag("event", "conversion", {
    send_to: `${CONVERSION_ID}/${label}`,
    value: value ?? 0,
    currency: "CLP",
  });
}
