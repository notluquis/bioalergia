// Phase 4b IA consolidation panel — wraps the existing AccountSettingsPage
// security UI (MFA + passkeys) so the `/account?tab=seguridad` host can
// mount it as a tab panel. The implementation lives in the original page
// file and is reused without the wizard scaffolding from onboarding.

export { AccountSettingsPage as SecurityPanel } from "@/pages/AccountSettingsPage";
