import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getApiUrl(path: string, siteSettings?: any): string {
  // 1. If we have a configured API URL in siteSettings, use it!
  if (siteSettings?.apiBaseUrl) {
    const base = siteSettings.apiBaseUrl.replace(/\/$/, ''); // strip trailing slash
    return `${base}${path}`;
  }
  
  // 2. Fallback: If VITE_BACKEND_URL environment variable is declared, use it.
  const envUrl = (import.meta as any).env?.VITE_BACKEND_URL;
  if (envUrl) {
    const base = envUrl.replace(/\/$/, '');
    return `${base}${path}`;
  }

  // 3. Smart Detection: If we are running on cdcos.vercel.app or a custom domain,
  // let's point to the primary AI Studio live preview/backend URL.
  const hostname = window.location.hostname;
  if (hostname && !hostname.includes('run.app') && !hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
    // We are on a custom domain like cdcos.vercel.app - fall back to the main Cloud Run App URL!
    return `https://ais-pre-auvu3lctrioame42hxvz3s-613468857344.asia-southeast1.run.app${path}`;
  }

  // Otherwise, use relative path local to host
  return path;
}

export async function apiFetch(path: string, options: any = {}, siteSettings?: any) {
  const url = getApiUrl(path, siteSettings);
  const idToken = options.idToken;
  
  // Decide whether to use Simple Request (no preflight) or Standard Request
  // Simple Requests are used when calling a cross-domain URL (i.e. not the current domain)
  const isCrossDomain = url.startsWith('http') && !url.includes(window.location.hostname);
  
  if (isCrossDomain) {
    // Avoid CORS preflight by:
    // 1. Using 'text/plain' content type (which doesn't trigger preflight)
    // 2. Putting the authentication token inside the body instead of 'Authorization' header!
    let bodyObj = {};
    if (options.body) {
      try {
        bodyObj = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      } catch (e) {
        bodyObj = { rawBody: options.body };
      }
    }
    
    if (idToken) {
      (bodyObj as any).idToken = idToken; // Inject the token in body
    }
    
    return fetch(url, {
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: JSON.stringify(bodyObj)
    });
  } else {
    // Standard request
    const headers = {
      'Content-Type': 'application/json',
      ...(idToken && { 'Authorization': `Bearer ${idToken}` }),
      ...options.headers
    };
    
    return fetch(url, {
      ...options,
      headers
    });
  }
}
