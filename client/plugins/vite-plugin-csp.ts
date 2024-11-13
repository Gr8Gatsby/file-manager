import { Plugin } from 'vite';
import crypto from 'crypto';

export default function cspPlugin(): Plugin {
  return {
    name: 'vite-plugin-csp',
    transformIndexHtml(html) {
      const nonce = crypto.randomBytes(16).toString('base64');
      
      // Add nonce to window for runtime access
      const scriptToInject = `<script nonce="${nonce}">window.__CSP_NONCE__ = "${nonce}";</script>`;
      
      // Essential React inline style hashes
      const essentialStyleHashes = [
        "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='", // empty style
        "'sha256-yR2gQAA8bLJrfGwaU4gHqE5oHE0ZurxHV8ZWyOsGh+Q='", // basic transforms
        "'sha256-Qiujj07H27Il85IPqEYA8KgvALmFcJjgSkvXXYzPzFE='", // React runtime styles
        "'sha256-4z94HBtDQ7TATlXQpTKGg1rMyQvXAdMgvQ5YYOMBiDs='" // Chart styles
      ];
      
      // Update CSP header with comprehensive style and script directives
      const updatedHtml = html.replace(
        /<meta http-equiv="Content-Security-Policy"[^>]*>/,
        `<meta http-equiv="Content-Security-Policy" content="
          default-src 'self';
          script-src 'self' 'nonce-${nonce}' 'unsafe-eval';
          style-src 'self' ${essentialStyleHashes.join(' ')} 'nonce-${nonce}';
          img-src 'self' blob: data:;
          connect-src 'self' ws: wss:;
          font-src 'self';
          object-src 'none';
          base-uri 'self';
          form-action 'self';
        " />`
      );
      
      // Add nonce to all scripts and styles
      const withNoncedTags = updatedHtml
        .replace(/<script/g, `<script nonce="${nonce}"`)
        .replace(/<style/g, `<style nonce="${nonce}"`);
      
      // Insert the nonce script before the first script tag
      return withNoncedTags.replace(
        /<script/,
        `${scriptToInject}<script`
      );
    }
  };
}
