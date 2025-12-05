/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_APP_BUILD_ID?: string;
  readonly VITE_APP_BUILD_TIMESTAMP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
