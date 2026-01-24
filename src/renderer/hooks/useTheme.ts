import { useState, useEffect } from 'react';

/**
 * useTheme - Custom hook for accessing current theme
 *
 * Monitors the data-theme attribute on document.documentElement
 * and returns the current theme value ('light' or 'dark').
 */
export const useTheme = () => {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const newTheme = document.documentElement.dataset.theme || 'light';
      setTheme(newTheme);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  return theme;
};
