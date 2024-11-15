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
    FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    ADD_TAGS: ['html', 'head', 'body'],
    WHOLE_DOCUMENT: true,
    SANITIZE_DOM: true,
    ALLOW_DATA_ATTR: false
  });
}
