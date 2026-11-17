import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSession, setSession } from '../lib/api';

const Ctx = createContext(null);
export const useSession = () => useContext(Ctx);

export function SessionProvider({ children }) {
  const [session, setS] = useState(() => getSession('assistant'));

  useEffect(() => {
    const out = (e) => e.detail === 'assistant' && setS(null);
    window.addEventListener('relay:signed-out', out);
    return () => window.removeEventListener('relay:signed-out', out);
  }, []);

  const signIn = useCallback((s) => {
    setSession('assistant', s);
    setS(s);
  }, []);
  const signOut = useCallback(() => {
    setSession('assistant', null);
    setS(null);
  }, []);

  const value = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
