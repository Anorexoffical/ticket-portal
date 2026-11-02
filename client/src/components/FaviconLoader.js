'use client';
import { useEffect } from 'react';

// Uses the agency logo (uploaded by the main admin) as the browser tab icon.
// If no logo was uploaded, nothing changes.
export default function FaviconLoader() {
  useEffect(() => {
    const url = `/api/uploads/file?path=branding/logo.png&v=${Math.floor(Date.now() / 3600000)}`;
    const img = new Image();
    img.onload = () => {
      document.querySelectorAll('link[rel~="icon"]').forEach(l => l.remove());
      const l = document.createElement('link');
      l.rel = 'icon'; l.href = url;
      document.head.appendChild(l);
    };
    img.src = url;
  }, []);
  return null;
}
