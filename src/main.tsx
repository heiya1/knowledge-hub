import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./i18n";
import "./styles/globals.css";

// Expose stores on window in dev mode for browser testing
if (import.meta.env.DEV) {
  import('./stores/workspaceStore').then(m => { (window as unknown as Record<string,unknown>).__workspaceStore = m.useWorkspaceStore; });
  import('./stores/navigationStore').then(m => { (window as unknown as Record<string,unknown>).__navigationStore = m.useNavigationStore; });
  import('./stores/documentStore').then(m => { (window as unknown as Record<string,unknown>).__documentStore = m.useDocumentStore; });
  import('./stores/editorStore').then(m => { (window as unknown as Record<string,unknown>).__editorStore = m.useEditorStore; });
  import('./stores/settingsStore').then(m => { (window as unknown as Record<string,unknown>).__settingsStore = m.useSettingsStore; });
  import('./stores/tabStore').then(m => { (window as unknown as Record<string,unknown>).__tabStore = m.useTabStore; });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
