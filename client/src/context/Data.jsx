import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from './Toast';

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function DataProvider({ children }) {
  const { toast } = useToast();
  const [me, setMe] = useState(null);
  const [threads, setThreads] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [events, setEvents] = useState({ list: [], unread: 0 });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const busy = useRef(0);

  const refresh = useCallback(async () => {
    if (busy.current > 0) return;
    try {
      const [t, a, e] = await Promise.all([api('/threads'), api('/accounts'), api('/events')]);
      setThreads((p) => (same(p, t.threads) ? p : t.threads));
      setAccounts((p) => (same(p, a.accounts) ? p : a.accounts));
      setEvents((p) => (same(p, { list: e.events, unread: e.unread }) ? p : { list: e.events, unread: e.unread }));
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      if (err.status !== 401) setError(err.message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    api('/auth/me').then(setMe).catch(() => {});
    refresh();
    const id = setInterval(() => document.visibilityState === 'visible' && refresh(), 6000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const replace = useCallback((t) => setThreads((prev) => prev.map((x) => (x._id === t._id ? t : x))), []);

  const run = useCallback(
    async (fn) => {
      busy.current += 1;
      try {
        return await fn();
      } finally {
        busy.current -= 1;
      }
    },
    [],
  );

  const fail = useCallback((err) => toast({ tone: 'error', title: 'That did not work', description: err.message }), [toast]);

  const patchThread = useCallback(
    async (id, body) => {
      const optimistic = {};
      for (const k of ['important', 'unread', 'status']) if (k in body) optimistic[k] = body[k];
      if (Object.keys(optimistic).length) setThreads((prev) => prev.map((x) => (x._id === id ? { ...x, ...optimistic } : x)));
      try {
        const r = await run(() => api(`/threads/${id}`, { method: 'PATCH', body }));
        replace(r.thread);
        return r.thread;
      } catch (e) {
        fail(e);
        refresh();
        return null;
      }
    },
    [replace, run, fail, refresh],
  );

  const threadAction = useCallback(
    async (id, path, body = {}) => {
      try {
        const r = await run(() => api(`/threads/${id}/${path}`, { method: 'POST', body }));
        replace(r.thread);
        return r.thread;
      } catch (e) {
        fail(e);
        return null;
      }
    },
    [replace, run, fail],
  );

  const markEventsSeen = useCallback(async () => {
    setEvents((p) => ({ ...p, unread: 0 }));
    try {
      await api('/events/seen', { method: 'POST' });
    } catch {
      /* non-critical */
    }
  }, []);

  const value = useMemo(
    () => ({ me, threads, accounts, events, loaded, error, lastUpdated, refresh, patchThread, threadAction, markEventsSeen, setAccounts }),
    [me, threads, accounts, events, loaded, error, lastUpdated, refresh, patchThread, threadAction, markEventsSeen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
