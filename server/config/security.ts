import rateLimit from "express-rate-limit";

// Content Security Policy
export const CSP_HEADER_VALUE = [
  "default-src 'self'",
  [
    "script-src",
    "'self'",
    "https://intranet.bioalergia.cl",
    "https://intranet.bioalergia.cl/assets/",
    "https://intranet.bioalergia.cl/cdn-cgi/scripts/7d0fa10a/cloudflare-static/",
    "https://intranet.bioalergia.cl/cdn-cgi/rum",
    "https://static.cloudflareinsights.com",
    "'unsafe-inline'",
  ].join(" "),
  ["worker-src", "'self'", "https://intranet.bioalergia.cl"].join(" "),
  ["connect-src", "'self'", "https://intranet.bioalergia.cl", "https://static.cloudflareinsights.com"].join(" "),
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join("; ");

// Rate Limiting (Basic DDoS Prevention)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: "Too many requests from this IP, please try again later.",
});

// Stricter Auth Rate Limiting
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 login attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
});
