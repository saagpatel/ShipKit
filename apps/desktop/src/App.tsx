import { useEffect, useMemo, useState } from "react";
import { DatabasePanel } from "./components/DatabasePanel";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { HomePanel } from "./components/HomePanel";
import { LogPanel } from "./components/LogPanel";
import { PluginsPanel } from "./components/PluginsPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { ThemePanel } from "./components/ThemePanel";
import { UpdatesPanel } from "./components/UpdatesPanel";
import { getCssVariables, getDesktopSettings } from "./lib/invoke";

type Route =
  | "home"
  | "database"
  | "settings"
  | "theme"
  | "logs"
  | "diagnostics"
  | "updates"
  | "plugins";

type RouteConfig = {
  route: Route;
  title: string;
  description: string;
};

const routes: RouteConfig[] = [
  {
    route: "home",
    title: "Home",
    description: "Runtime summary and quick actions.",
  },
  {
    route: "database",
    title: "Database",
    description: "Review, apply, and rollback migrations.",
  },
  {
    route: "settings",
    title: "Settings",
    description: "Edit persisted app settings.",
  },
  {
    route: "theme",
    title: "Theme",
    description: "Switch themes and inspect CSS.",
  },
  {
    route: "logs",
    title: "Logs",
    description: "Review recent runtime activity.",
  },
  {
    route: "diagnostics",
    title: "Diagnostics",
    description: "Review paths and export support bundles.",
  },
  {
    route: "updates",
    title: "Updates",
    description: "Review the local-only updater posture.",
  },
  {
    route: "plugins",
    title: "Plugins",
    description: "Manage the curated plugin catalog.",
  },
];

function routeFromHash(hash: string): Route {
  const normalized = hash.replace(/^#\/?/, "").trim();
  const match = routes.find((entry) => entry.route === normalized);
  return match?.route ?? "home";
}

function routeFromPreference(route: string): Route {
  const match = routes.find((entry) => entry.route === route);
  return match?.route ?? "home";
}

function App() {
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash));
  const [themeCss, setThemeCss] = useState("");

  useEffect(() => {
    const syncRoute = () => setRoute(routeFromHash(window.location.hash));
    const syncInitialRoute = () => {
      if (window.location.hash) {
        syncRoute();
        return;
      }

      getDesktopSettings()
        .then((settings) => {
          const preferredRoute = routeFromPreference(settings.startup_route);
          window.location.hash = `/${preferredRoute}`;
          setRoute(preferredRoute);
        })
        .catch(() => setRoute("home"));
    };
    const refreshTheme = () => {
      getCssVariables()
        .then(setThemeCss)
        .catch(() => setThemeCss(""));
    };

    syncInitialRoute();
    refreshTheme();
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("shipkit:theme-updated", refreshTheme as EventListener);

    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener(
        "shipkit:theme-updated",
        refreshTheme as EventListener,
      );
    };
  }, []);

  const activeRoute = useMemo(
    () =>
      routes.find((entry) => entry.route === route) ?? {
        route: "home",
        title: "Home",
        description: "Runtime summary and quick actions.",
      },
    [route],
  );

  const renderRoute = () => {
    switch (route) {
      case "database":
        return <DatabasePanel />;
      case "settings":
        return <SettingsPanel />;
      case "theme":
        return <ThemePanel />;
      case "logs":
        return <LogPanel />;
      case "diagnostics":
        return <DiagnosticsPanel />;
      case "updates":
        return <UpdatesPanel />;
      case "plugins":
        return <PluginsPanel />;
      case "home":
      default:
        return <HomePanel />;
    }
  };

  return (
    <div className="app-shell">
      {themeCss ? <style>{themeCss}</style> : null}

      <aside className="app-sidebar">
        <p className="eyebrow">macOS operator console</p>
        <h1>ShipKit</h1>
        <p>One local macOS workspace for runtime control and support tasks.</p>

        <nav className="nav-list" aria-label="Primary">
          {routes.map((entry) => (
            <button
              key={entry.route}
              className={`nav-button${entry.route === route ? " is-active" : ""}`}
              onClick={() => {
                window.location.hash = `/${entry.route}`;
              }}
              type="button"
            >
              <strong>{entry.title}</strong>
              <span>{entry.description}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <strong>Current track</strong>
          <span>Run a reliable local macOS workflow with truthful verification.</span>
        </div>
      </aside>

      <main className="app-main">
        <div className="workspace-frame">
          <header className="workspace-header">
            <div>
              <p className="eyebrow">Workspace</p>
              <p className="workspace-title">{activeRoute.title}</p>
              <p>{activeRoute.description}</p>
            </div>
            <span className="header-badge">macOS local-only</span>
          </header>

          <div className="workspace-body">{renderRoute()}</div>
        </div>
      </main>
    </div>
  );
}

export default App;
