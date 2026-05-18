// Phase 4b IA consolidation panel — re-export of the existing CSV upload
// settings page so the `/admin/database?tab=importar` host can mount it as
// a tab panel without duplicating the (large) implementation. The original
// file remains the source of truth.

export { CSVUploadPage as CSVUploadPanel } from "@/pages/settings/CSVUploadPage";
