import type { Update as NativeUpdate } from "@tauri-apps/plugin-updater";
import type {
  AppOverview,
  CommandErrorShape,
  DatabaseOverview,
  DesktopSettings,
  LogEntry,
  MigrationStatus,
  PluginStatus,
  SupportBundleArtifact,
  SupportBundleSummary,
  ThemeDefinition,
} from "./lib/bindings";
import type {
  AvailableUpdateSummary,
  ConfiguredFeedManifest,
  UpdateBuildDefaults,
  UpdateDownloadProgress,
} from "./lib/updater";

/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly MODE: string;
    readonly VITE_SHIPKIT_UPDATE_CHANNEL?: string;
    readonly VITE_SHIPKIT_RELEASE_HOST?: string;
    readonly VITE_SHIPKIT_RELEASE_REPOSITORY?: string;
    readonly VITE_SHIPKIT_RELEASE_ARTIFACT_BASE_URL?: string;
    readonly VITE_SHIPKIT_TAURI_UPDATER_ENDPOINT?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Window {
    __SHIPKIT_E2E_BRIDGE__?: {
      invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
      getUpdateBuildDefaults(): UpdateBuildDefaults;
      checkForUpdates(): Promise<{
        update: NativeUpdate | null;
        summary: AvailableUpdateSummary | null;
      }>;
      inspectConfiguredFeed(
        manifestUrl: string | null,
      ): Promise<ConfiguredFeedManifest>;
      downloadAndInstallUpdate(
        update: NativeUpdate,
        onProgress?: (progress: UpdateDownloadProgress) => void,
      ): Promise<void>;
      relaunchAfterUpdate(): Promise<void>;
      controls: {
        reset(): void;
        clearStorage(): void;
        setFault(name: string, enabled: boolean): void;
        getState(): {
          desktopSettings: DesktopSettings;
          migrations: MigrationStatus[];
          databaseOverview: DatabaseOverview;
          theme: ThemeDefinition;
          logs: LogEntry[];
          plugins: PluginStatus[];
          supportBundles: SupportBundleArtifact[];
          appOverview: AppOverview;
        };
        setManifestConfigured(enabled: boolean): void;
        setUpdateAvailable(enabled: boolean): void;
        seedEmptyPlugins(): void;
      };
      commandErrors: Record<string, CommandErrorShape>;
      supportSummary(summary: SupportBundleSummary): string;
    };
  }
}

export {};
