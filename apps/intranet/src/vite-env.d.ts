/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly VITE_APP_BUILD_ID?: string;
  readonly VITE_APP_BUILD_TIMESTAMP?: string;
  readonly VITE_LOCAL_MAIL_AGENT_URL?: string;
}
