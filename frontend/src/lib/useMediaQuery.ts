import { useEffect, useState } from 'react';

/** true mientras la media query se cumpla; se actualiza al rotar o redimensionar. */
export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
  const [match, setMatch] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatch(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return match;
}
