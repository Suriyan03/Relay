import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, ShieldCheck, Mail, Send, Eye, Sparkles, Info } from 'lucide-react';
import { api } from '../lib/api';
import { Button, ErrorBanner, cx } from './ui';
import { ProviderTile, providerName } from './badges';

const STAGES = [
  { id: 'authorizing', label: 'Authorizing access' },
  { id: 'fetching', label: 'Fetching conversations' },
  { id: 'analyzing', label: 'AI is sorting who replies' },
];

/**
 * Simulated OAuth + sync for Gmail / Outlook.
 * Step 1: a mock consent screen. Step 2: real sync job on the server with live progress.
 */
export function ConnectFlow({ provider, clientName, onDone, onCancel }) {
  const [step, setStep] = useState('consent');
  const [account, setAccount] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
  alive.current = true;
  return () => {
    alive.current = false;
  };
}, []);

  async function allow() {
    setBusy(true);
    setError(null);
    try {
      const { account: a } = await api('/accounts/connect', { method: 'POST', body: { provider } });
      setAccount(a);
      setStep('syncing');
      poll(a._id);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function poll(id) {
    while (alive.current) {
      await new Promise((r) => setTimeout(r, 650));
      try {
        const { accounts } = await api('/accounts');
        const a = accounts.find((x) => x._id === id);
        if (!a) return;
        if (!alive.current) return;
        setAccount(a);
        if (a.status === 'connected') {
          setStep('done');
          return;
        }
        if (a.status === 'error') {
          setError(a.error || 'The sync failed.');
          return;
        }
      } catch (e) {
        if (alive.current) setError(e.message);
        return;
      }
    }
  }

  const name = providerName(provider);

  if (step === 'consent') {
    return (
      <div>
        <div className="flex items-center gap-3">
          <ProviderTile provider={provider} size={44} />
          <div>
            <p className="font-semibold leading-5">Connect {clientName ? `${clientName}'s ` : ''}{name}</p>
            <p className="text-sm text-ink-mute">Relay asks for the access below.</p>
          </div>
        </div>
        <ul className="mt-5 divide-y divide-line-soft rounded-lg border border-line">
          {[
            [Eye, 'Read messages and conversation history', 'So the AI can decide who needs to reply.'],
            [Send, 'Send replies you have approved', 'Nothing is sent without your explicit approval.'],
            [Mail, 'See read and unread status', 'To keep your inbox and Relay in step.'],
          ].map(([Icon, t, d]) => (
            <li key={t} className="flex items-start gap-3 px-4 py-3">
              <Icon className="mt-0.5 h-4 w-4 text-ink-mute" aria-hidden />
              <div>
                <p className="text-sm font-medium">{t}</p>
                <p className="text-[13px] text-ink-mute">{d}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2.5 rounded-lg bg-cobalt-50 px-3.5 py-3 text-[13px] leading-5 text-cobalt-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            This consent screen is simulated for the prototype. No real {provider === 'gmail' ? 'Google' : 'Microsoft'} sign-in happens, and Relay loads sample conversations. In production this step is the provider’s own OAuth screen.
          </p>
        </div>
        {error && <div className="mt-4"><ErrorBanner message={error} /></div>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
          <Button variant="primary" icon={ShieldCheck} onClick={allow} loading={busy}>Allow access</Button>
        </div>
      </div>
    );
  }

  const stageIdx = step === 'done' ? 3 : Math.max(0, STAGES.findIndex((s) => s.id === account?.stage));
  const { done = 0, total = 0 } = account?.progress || {};

  return (
    <div>
      <div className="flex items-center gap-3">
        <ProviderTile provider={provider} size={44} />
        <div className="min-w-0">
          <p className="truncate font-semibold leading-5">{account?.email || name}</p>
          <p className="text-sm text-ink-mute">{step === 'done' ? `${total} conversations ready` : 'Syncing now'}</p>
        </div>
      </div>
      <ol className="mt-5 space-y-3" aria-live="polite">
        {STAGES.map((s, i) => {
          const state = i < stageIdx ? 'done' : i === stageIdx ? 'active' : 'todo';
          return (
            <li key={s.id} className="flex items-center gap-3">
              <span className={cx('flex h-6 w-6 items-center justify-center rounded-full', state === 'done' ? 'bg-emerald-500 text-white' : state === 'active' ? 'bg-orchid-100 text-orchid-600' : 'bg-slate-100 text-slate-400')}>
                {state === 'done' ? <Check className="h-3.5 w-3.5" /> : state === 'active' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <div className="flex-1">
                <p className={cx('text-sm', state === 'todo' ? 'text-ink-faint' : 'font-medium')}>{s.label}</p>
                {s.id === 'analyzing' && state !== 'todo' && total > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
                      <span className="block h-full rounded-full bg-orchid-500 transition-all duration-300" style={{ width: `${Math.round((done / total) * 100)}%` }} />
                    </span>
                    <span className="text-xs tabular-nums text-ink-mute">{done} of {total}</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {error && <div className="mt-4"><ErrorBanner message={error} onRetry={() => { setError(null); poll(account._id); }} /></div>}
      {step === 'done' && (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="primary" icon={Sparkles} onClick={() => onDone(account)}>Open inbox</Button>
        </div>
      )}
    </div>
  );
}
