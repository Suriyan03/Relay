import { useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert, Unplug, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useData } from '../context/Data.jsx';
import { useToast } from '../context/Toast.jsx';
import { Button, Modal, cx } from './ui.jsx';
import { ProviderTile, providerName } from './badges.jsx';
import { ConnectFlow } from './ConnectFlow.jsx';
import { firstName, plural, timeAgo } from '../lib/format';

const STATUS = {
  connected: { dot: 'bg-emerald-500', label: 'Connected' },
  syncing: { dot: 'bg-orchid-500 animate-pulse', label: 'Syncing' },
  needs_reauth: { dot: 'bg-marigold-400', label: 'Needs reconnect' },
  error: { dot: 'bg-rose-500', label: 'Sync error' },
};
const STAGE = { authorizing: 'Authorizing access', fetching: 'Fetching conversations', analyzing: 'AI is sorting who replies' };

export function AccountsButton({ clientName }) {
  const { accounts, refresh } = useData();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState(null);
  const [busy, setBusy] = useState(null);

  // While any account is syncing, poll quickly so progress is visible.
  const syncing = accounts.some((a) => a.status === 'syncing');
  useEffect(() => {
    if (!syncing) return;
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [syncing, refresh]);

  async function run(a, action, okMsg) {
    setBusy(`${a._id}:${action}`);
    try {
      await api(`/accounts/${a._id}/${action}`, { method: 'POST' });
      await refresh();
      if (okMsg) toast({ title: okMsg });
    } catch (e) {
      toast({ tone: 'error', title: 'That did not work', description: e.message });
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(a) {
    if (!window.confirm(`Disconnect ${a.email}? Its conversations will be removed from Relay.`)) return;
    setBusy(`${a._id}:delete`);
    try {
      await api(`/accounts/${a._id}`, { method: 'DELETE' });
      await refresh();
      toast({ title: 'Account disconnected' });
    } catch (e) {
      toast({ tone: 'error', title: 'That did not work', description: e.message });
    } finally {
      setBusy(null);
    }
  }

  const focus = accounts.find((a) => a.status !== 'connected') || accounts[0];
  if (!focus) return null;
  const missing = ['gmail', 'outlook'].filter((p) => !accounts.some((a) => a.provider === p));
  const st = STATUS[focus.status] || STATUS.connected;

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Connected accounts" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-soft hover:bg-slate-900/5">
        <ProviderTile provider={focus.provider} size={24} />
        <span className="hidden max-w-[14rem] truncate sm:inline">{focus.email}</span>
        <span className={cx('h-2 w-2 rounded-full', st.dot)} aria-hidden />
        {accounts.length > 1 && <span className="text-xs text-ink-mute">+{accounts.length - 1}</span>}
        {focus.status !== 'connected' && <span className="hidden text-xs font-medium text-marigold-700 sm:inline">{st.label}</span>}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Connected accounts" description={`Mailboxes Relay reads for ${firstName(clientName)}.`} width="max-w-xl">
        <ul className="space-y-3 pb-2">
          {accounts.map((a) => {
            const s = STATUS[a.status] || STATUS.connected;
            const is = (action) => busy === `${a._id}:${action}`;
            return (
              <li key={a._id} className="rounded-xl border border-line p-4">
                <div className="flex items-center gap-3">
                  <ProviderTile provider={a.provider} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.email}</p>
                    <p className="flex items-center gap-1.5 text-[13px] text-ink-mute">
                      <span className={cx('h-2 w-2 rounded-full', s.dot)} aria-hidden /> {providerName(a.provider)} · {s.label}
                    </p>
                  </div>
                </div>

                {a.status === 'syncing' && (
                  <p className="mt-3 text-[13px] text-orchid-700">
                    {STAGE[a.stage] || 'Syncing'}
                    {a.stage === 'analyzing' && a.progress?.total > 0 && ` · ${a.progress.done} of ${a.progress.total}`}
                  </p>
                )}
                {a.error && a.status !== 'syncing' && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-marigold-50 px-3 py-2 text-[13px] text-marigold-700">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {a.error}
                  </p>
                )}
                <p className="mt-3 text-xs text-ink-mute">
                  {plural(a.threadCount || 0, 'conversation')}
                  {a.lastSyncAt && ` · last synced ${timeAgo(a.lastSyncAt)}`}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {a.status === 'needs_reauth' ? (
                    <Button size="sm" variant="primary" icon={ShieldAlert} loading={is('reconnect')} onClick={() => run(a, 'reconnect', 'Reconnected')}>Reconnect</Button>
                  ) : (
                    <Button size="sm" icon={RefreshCw} loading={is('sync')} disabled={a.status === 'syncing'} onClick={() => run(a, 'sync', 'Sync finished')}>Sync now</Button>
                  )}
                  {a.status === 'connected' && (
                    <Button size="sm" variant="ghost" loading={is('expire')} onClick={() => run(a, 'expire')}>Simulate expired access</Button>
                  )}
                  <Button size="sm" variant="ghost" icon={Unplug} loading={is('delete')} onClick={() => disconnect(a)} className="ml-auto text-rose-700">Disconnect</Button>
                </div>
              </li>
            );
          })}
        </ul>

        {missing.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2">
            {missing.map((p) => (
              <Button key={p} size="sm" icon={Plus} onClick={() => { setOpen(false); setConnecting(p); }}>
                Connect {providerName(p)}
              </Button>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={!!connecting} onClose={() => setConnecting(null)} title="Connect account" width="max-w-md">
        {connecting && (
          <ConnectFlow
            provider={connecting}
            clientName={firstName(clientName)}
            onDone={async () => {
              await refresh();
              setConnecting(null);
            }}
            onCancel={() => setConnecting(null)}
          />
        )}
      </Modal>
    </>
  );
}