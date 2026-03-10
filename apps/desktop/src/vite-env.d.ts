/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHIPKIT_UPDATE_CHANNEL?: string;
  readonly VITE_SHIPKIT_RELEASE_HOST?: string;
  readonly VITE_SHIPKIT_RELEASE_REPOSITORY?: string;
  readonly VITE_SHIPKIT_RELEASE_ARTIFACT_BASE_URL?: string;
  readonly VITE_SHIPKIT_TAURI_UPDATER_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
