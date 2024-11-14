import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { SWRConfig } from "swr";
import { fetcher } from "./lib/fetcher";
import { FileManager } from "./pages/FileManager";
import { Toaster } from "@/components/ui/toaster";
import { useRouteHandler } from "./hooks/use-router";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Error caught by boundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  useRouteHandler();

  return (
    <ErrorBoundary>
      <SWRConfig value={{ fetcher }}>
        <Switch>
          <Route path="/" component={FileManager} />
          <Route path="/file-manager">
            <FileManager />
          </Route>
          <Route>
            <div className="flex min-h-screen items-center justify-center">
              <h1 className="text-xl font-semibold">404 Page Not Found</h1>
            </div>
          </Route>
        </Switch>
        <Toaster />
      </SWRConfig>
    </ErrorBoundary>
  );
}

// Root instance management
let rootInstance: ReturnType<typeof createRoot> | null = null;

function cleanup() {
  if (rootInstance) {
    try {
      console.log('Root cleanup: Starting unmount');
      rootInstance.unmount();
      rootInstance = null;
      console.log('Root cleanup: Completed successfully');
    } catch (error) {
      console.error('Root cleanup: Error during unmount:', error);
    }
  }
}

function initializeApp() {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error('Root initialization: Root element not found');
    throw new Error("Root element not found");
  }

  cleanup();

  console.log('Root initialization: Creating new instance');
  rootInstance = createRoot(rootElement);
  
  const AppWithStrictMode = process.env.NODE_ENV === 'development' 
    ? <StrictMode><App /></StrictMode>
    : <App />;

  rootInstance.render(AppWithStrictMode);
  console.log('Root initialization: Render complete');
}

// Handle HMR
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    console.log('HMR: Cleaning up before update');
    cleanup();
  });
}

// Initial render
initializeApp();

export { App };
