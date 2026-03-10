import { useEffect, useState } from "react";
import type { ThemeDefinition } from "../lib/bindings";
import {
  formatCommandError,
  getCssVariables,
  getTheme,
  listThemes,
  setTheme,
} from "../lib/invoke";

export function ThemePanel() {
  const [themes, setThemes] = useState<ThemeDefinition[]>([]);
  const [current, setCurrent] = useState<ThemeDefinition | null>(null);
  const [css, setCss] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listThemes()
      .then(setThemes)
      .catch((e: unknown) => setError(formatCommandError(e)));
    getTheme()
      .then(setCurrent)
      .catch((e: unknown) => setError(formatCommandError(e)));
    getCssVariables()
      .then(setCss)
      .catch((e: unknown) => setError(formatCommandError(e)));
  }, []);

  const handleSwitch = (name: string) => {
    setTheme(name)
      .then((t) => {
        setCurrent(t);
        window.dispatchEvent(new Event("shipkit:theme-updated"));
        return getCssVariables();
      })
      .then(setCss)
      .catch((e: unknown) => setError(formatCommandError(e)));
  };

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Visual system</p>
          <h2>Theme</h2>
          <p className="page-copy">
            Switch the active theme, preview the generated CSS variables, and
            verify that the desktop shell updates with the selected palette.
          </p>
        </div>
      </header>

      {error ? <p className="callout callout-error">{error}</p> : null}

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Active theme</p>
            <h3>
              {current ? `${current.name} (${current.mode})` : "Loading theme state"}
            </h3>
          </div>
          <div className="panel-actions">
            {themes.map((t) => (
              <button
                key={t.name}
                className={`panel-button${current?.name === t.name ? " is-active" : ""}`}
                onClick={() => handleSwitch(t.name)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {css ? <pre className="panel-pre">{css}</pre> : null}
      </section>
    </section>
  );
}
