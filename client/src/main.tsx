import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route, useLocation } from "wouter";
import "./index.css";
import { SWRConfig } from "swr";
import { fetcher } from "./lib/fetcher";
import { FileManager } from "./pages/FileManager";
import { Toaster } from "@/components/ui/toaster";

// Handle GitHub Pages SPA redirect
function RouterHandler() {
  const [_, setLocation] = useLocation();

  useEffect(() => {
    const path = localStorage.getItem('spa-path');
    if (path) {
      localStorage.removeItem('spa-path');
      setLocation(path);
    }
  }, [setLocation]);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SWRConfig value={{ fetcher }}>
      <RouterHandler />
      <Switch>
        <Route path="/" component={FileManager} />
        <Route>404 Page Not Found</Route>
      </Switch>
      <Toaster />
    </SWRConfig>
  </StrictMode>,
);
