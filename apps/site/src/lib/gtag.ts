/**
 * Google Ads conversion tracking helper.
 * Conversion ID: AW-360676950
 *
 * To add conversion labels, create conversion actions in Google Ads:
 * Tools → Conversions → + New conversion action → Website
 * Then update the labels below.
 */

const CONVERSION_ID = "AW-360676950";

const CONVERSION_LABELS = {
  doctoralia_booking: "Kr90CP_iuqQcENb8_asB",
  whatsapp_click: "", // TODO: add label from Google Ads
  email_click: "", // TODO: add label from Google Ads
  phone_click: "", // TODO: add label from Google Ads
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
