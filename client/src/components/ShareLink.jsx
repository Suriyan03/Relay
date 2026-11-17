import { useEffect, useState } from 'react';
import { Link2, Copy, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context/Toast.jsx';
import { Button, Popover } from './ui.jsx';
import { firstName } from '../lib/format';

export function ShareLink({ clientName, initialToken }) {
  const { toast } = useToast();
  const [token, setToken] = useState(initialToken || null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setToken(initialToken || null), [initialToken]);

  const url = token ? `${window.location.origin}/c/${token}` : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied' });
    } catch {
      toast({ tone: 'info', title: 'Copy it by hand', description: url });
    }
  }

  async function rotate() {
    setBusy(true);
    try {
      const r = await api('/workspace/rotate-link', { method: 'POST' });
      setToken(r.inviteToken);
      toast({ title: 'New link created', description: 'The old link no longer works.' });
    } catch (e) {
      toast({ tone: 'error', title: 'That did not work', description: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover
      width="w-[22rem]"
      trigger={({ toggle }) => (
        <Button variant="secondary" size="sm" icon={Link2} onClick={toggle}>
          Share with {firstName(clientName)}
        </Button>
      )}
    >
      <div className="p-4">
        <h3 className="text-sm font-semibold">{firstName(clientName)}'s private page</h3>
        <p className="mt-1 text-[13px] leading-5 text-ink-mute">
          A simple page with only the emails that need {firstName(clientName)}. No password, so share it carefully.
        </p>
        {url ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-900/5 py-1.5 pl-3 pr-1.5">
            <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">{url}</span>
            <Button size="sm" variant="primary" icon={Copy} onClick={copy}>Copy</Button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-mute">No link yet. Create one below.</p>
        )}
        <div className="mt-3 flex items-center justify-between">
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-cobalt-600 hover:underline">
              Open it
            </a>
          )}
          <Button size="sm" variant="ghost" icon={RefreshCw} loading={busy} onClick={rotate} className="ml-auto">
            {url ? 'Make a new link' : 'Create link'}
          </Button>
        </div>
      </div>
    </Popover>
  );
}