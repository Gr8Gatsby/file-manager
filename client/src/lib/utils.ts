import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function createElementWithNonce(tag: string): HTMLElement {
  const el = document.createElement(tag);
  const nonce = (window as any).__CSP_NONCE__;
  if (nonce) {
    el.setAttribute('nonce', nonce);
  }
  return el;
}
