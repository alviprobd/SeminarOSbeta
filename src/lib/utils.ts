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
