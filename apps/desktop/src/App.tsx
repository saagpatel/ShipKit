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
    description: "Status, quick orientation, and current runtime summary.",
  },
  {
    route: "database",
    title: "Database",
    description: "Review migration readiness and apply or rollback safely.",
  },
  {
    route: "settings",
    title: "Settings",
    description: "Inspect and update persisted app configuration.",
  },
  {
    route: "theme",
    title: "Theme",
    description: "Preview active theme variables and switch modes.",
  },
  {
    route: "logs",
    title: "Logs",
    description: "Inspect recent runtime activity and exported diagnostics.",
  },
  {
    route: "diagnostics",
    title: "Diagnostics",
    description: "Review runtime paths and export a local support bundle.",
  },
  {
    route: "updates",
    title: "Updates",
    description: "Check the signed feed, install a newer build, and relaunch safely.",
  },
  {
    route: "plugins",
    title: "Plugins",
    description: "Review the curated plugin catalog and enable the modules you trust.",
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
        description: "Status, quick orientation, and current runtime summary.",
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
        <p className="eyebrow">Execution Console</p>
        <h1>ShipKit</h1>
        <p>One desktop workspace for migrations, settings, theme, and logs.</p>

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
          <span>Repo truth, shell productization, and desktop hardening.</span>
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
            <span className="header-badge">macOS-first production path</span>
          </header>

          <div className="workspace-body">{renderRoute()}</div>
        </div>
      </main>
    </div>
  );
}

export default App;
