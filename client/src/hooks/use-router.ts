import { useLayoutEffect, useRef } from "react";
import { useLocation } from "wouter";

// Single initialization flag with cleanup tracking
const routerState = {
  initialized: false,
  mountCount: 0
};

export function useRouteHandler() {
  const [_, setLocation] = useLocation();
  const mountRef = useRef(false);

  useLayoutEffect(() => {
    if (mountRef.current) {
      console.log('RouterHandler: Instance already mounted, skipping');
      return;
    }

    mountRef.current = true;
    routerState.mountCount++;
    
    console.log('RouterHandler: Starting initialization', {
      isInitialized: routerState.initialized,
      mountCount: routerState.mountCount
    });

    if (!routerState.initialized) {
      try {
        const redirect = sessionStorage.redirect;
        const currentPath = window.location.pathname;

        // Normalize path function
        const normalizePath = (path: string) => {
          const cleanPath = path.replace(/^\/file-manager\/?/, '/');
          return cleanPath || '/';
        };

        console.log('RouterHandler: Current state:', {
          redirect: redirect || 'none',
          currentPath,
          isDevelopment: process.env.NODE_ENV === 'development'
        });

        if (redirect) {
          delete sessionStorage.redirect;
          try {
            const url = new URL(redirect);
            const normalizedPath = normalizePath(url.pathname);
            console.log('RouterHandler: Setting redirect path:', normalizedPath);
            setLocation(normalizedPath);
          } catch (error) {
            console.error('RouterHandler: Failed to parse redirect URL:', error);
            setLocation('/');
          }
        } else if (currentPath.startsWith('/file-manager/')) {
          const normalizedPath = normalizePath(currentPath);
          console.log('RouterHandler: Converting GitHub Pages path:', normalizedPath);
          setLocation(normalizedPath);
        } else {
          const normalizedPath = normalizePath(currentPath);
          console.log('RouterHandler: Using direct path:', normalizedPath);
          setLocation(normalizedPath);
        }

        routerState.initialized = true;
        console.log('RouterHandler: Initialization complete');
      } catch (error) {
        console.error('RouterHandler: Critical initialization error:', error);
        setLocation('/');
        routerState.initialized = true;
      }
    }

    // Cleanup function
    return () => {
      console.log('RouterHandler: Cleanup', { mountCount: routerState.mountCount });
      mountRef.current = false;
      routerState.mountCount--;
      
      // Reset initialization state when all instances are unmounted
      if (routerState.mountCount === 0) {
        console.log('RouterHandler: Full cleanup - resetting state');
        routerState.initialized = false;
      }
    };
  }, [setLocation]);

  return null;
}
