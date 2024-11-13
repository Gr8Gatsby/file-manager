import { Plugin } from 'vite';
import crypto from 'crypto';

export default function cspPlugin(): Plugin {
  return {
    name: 'vite-plugin-csp',
    transformIndexHtml(html) {
      // Generate a unique nonce for each build
      const nonce = crypto.randomBytes(16).toString('base64');
      
      // Replace the CSP meta tag with updated nonce
      const updatedHtml = html.replace(
        /<meta http-equiv="Content-Security-Policy"[^>]*>/,
        `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'nonce-${nonce}' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';" />`
      );
      
      // Add nonce to all script tags
      return updatedHtml.replace(
        /<script/g,
        `<script nonce="${nonce}"`
      );
    }
  };
}
