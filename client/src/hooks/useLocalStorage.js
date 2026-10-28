import { useCallback, useEffect, useState } from 'react';

/**
 * State backed by localStorage. Access is wrapped in try/catch because a
 * private window or blocked site data makes the accessor itself throw.
 */
export function useLocalStorage(key, initialValue = '') {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? initialValue : stored;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      if (value === '' || value === null || value === undefined) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, value);
      }
    } catch {
      /* storage unavailable: the app still works, the value just is not kept */
    }
  }, [key, value]);

  const reset = useCallback(() => setValue(initialValue), [initialValue]);

  return [value, setValue, reset];
}
