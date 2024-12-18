import DOMPurify from 'dompurify';

export interface HTMLValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateHTML(content: string): HTMLValidationResult {
  const errors: string[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');

  // Check for parsing errors
  const parserErrors = doc.getElementsByTagName('parsererror');
  if (parserErrors.length > 0) {
    errors.push('Invalid HTML structure');
    return { isValid: false, errors };
  }

  // Check required elements
  if (!doc.documentElement) {
    errors.push('Missing <html> element');
  }
  if (!doc.head) {
    errors.push('Missing <head> element');
  }
  if (!doc.body) {
    errors.push('Missing <body> element');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function sanitizeHTML(content: string): string {
  return DOMPurify.sanitize(content, {
    FORBID_TAGS: ['iframe', 'frame', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    ADD_TAGS: ['html', 'head', 'body', 'style', 'script'],
    ALLOWED_TAGS: ['style', 'script'],  // Explicitly allow these
    ADD_ATTR: ['type', 'src'],  // Allow script attributes
    WHOLE_DOCUMENT: true,
    SANITIZE_DOM: true,
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM: false
  });
}

export function formatHTML(html: string): string {
  const beautify = (str: string, level: number = 0): string => {
    const indent = '  '.repeat(level);
    const tokens = str.split(/(<\/?[^>]+>)/g);
    let result = '';
    let newLevel = level;

    tokens.forEach(token => {
      if (!token.trim()) return;
      
      if (token.startsWith('</')) {
        newLevel--;
        result += indent + token + '\n';
      } else if (token.startsWith('<') && !token.endsWith('/>') && !token.startsWith('<!') && !token.startsWith('<?')) {
        result += indent + token + '\n';
        if (!token.startsWith('<script') && !token.startsWith('<style')) {
          newLevel++;
        }
      } else {
        result += indent + token.trim() + '\n';
      }
    });
    
    return result;
  };

  try {
    return beautify(html);
  } catch (error) {
    console.warn('HTML formatting failed:', error);
    return html;
  }
}
