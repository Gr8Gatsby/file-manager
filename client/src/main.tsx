import React, { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route, useLocation } from "wouter";
import "./index.css";
import { SWRConfig } from "swr";
import { fetcher } from "./lib/fetcher";
import { FileManager } from "./pages/FileManager";
import { Toaster } from "@/components/ui/toaster";

function RouterHandler() {
  const [_, setLocation] = useLocation();

  useEffect(() => {
    const redirect = sessionStorage.redirect;
    if (redirect) {
      delete sessionStorage.redirect;
      try {
        const url = new URL(redirect);
        const path = url.pathname.replace('/file-manager', '');
        setLocation(path || '/');
      } catch (error) {
        console.error('Failed to parse redirect URL:', error);
        setLocation('/');
      }
    }
  }, [setLocation]);

  return null;
}

// Export App component for dev tools
export function App() {
  return (
    <StrictMode>
      <SWRConfig value={{ fetcher }}>
        <RouterHandler />
        <Switch>
          <Route path="/" component={FileManager} />
          <Route>404 Page Not Found</Route>
        </Switch>
        <Toaster />
      </SWRConfig>
    </StrictMode>
  );
}

// Get the root element
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

// Create root only if it hasn't been created before
let root: ReturnType<typeof createRoot>;
try {
  root = createRoot(rootElement);
} catch (error) {
  // If root already exists, find the existing root
  root = (rootElement as any)._reactRootContainer?._internalRoot || createRoot(rootElement);
}

// Initial render
root.render(<App />);
