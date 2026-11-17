import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, LogOut, ShieldCheck, Sparkles, Check } from 'lucide-react';
import { useSession } from '../context/Session.jsx';
import { useData } from '../context/Data.jsx';
import { Button, Modal } from '../components/ui.jsx';
import { Logo, ProviderTile, providerName } from '../components/badges.jsx';
import { ConnectFlow } from '../components/ConnectFlow.jsx';
import { firstName } from '../lib/format';

const PROVIDERS = [
  { id: 'gmail', blurb: 'Google Workspace or personal Gmail' },
  { id: 'outlook', blurb: 'Microsoft 365 or Outlook.com' },
];

export default function Onboarding() {
  const nav = useNavigate();
  const { session, signOut } = useSession();
  const { me, accounts, refresh } = useData();
  const [connecting, setConnecting] = useState(null);
  const client = session.workspace?.clientName || 'your client';
  const connected = accounts.filter((a) => a.status === 'connected');

  async function finish() {
    await refresh();
    setConnecting(null);
    nav('/app', { replace: true });
  }

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        <Button variant="ghost" size="sm" icon={LogOut} onClick={signOut}>Sign out</Button>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-16 pt-6 sm:pt-12">
        <p className="text-sm font-medium text-cobalt-600">Welcome, {firstName(session.user.name)}</p>
        <h1 className="mt-2 text-[34px] font-semibold leading-[1.1] sm:text-[40px]">Connect {client === 'your client' ? client : `${firstName(client)}’s`} inbox</h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-ink-soft">
          Relay reads each conversation and decides who should reply. You keep control: change any decision, and nothing is sent without your approval.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {PROVIDERS.map((p) => {
            const done = connected.some((a) => a.provider === p.id);
            return (
              <div key={p.id} className="flex flex-col rounded-2xl border border-line bg-white p-5 shadow-lift">
                <ProviderTile provider={p.id} size={48} />
                <h2 className="mt-4 text-lg font-semibold">{providerName(p.id)}</h2>
                <p className="mt-0.5 text-sm text-ink-mute">{p.blurb}</p>
                <div className="mt-6">
                  {done ? (
                    <span className="inline-flex h-10 items-center gap-2 text-sm font-medium text-emerald-700">
                      <Check className="h-4 w-4" /> Connected
                    </span>
                  ) : (
                    <Button variant="primary" className="w-full" onClick={() => setConnecting(p.id)}>
                      Connect {providerName(p.id)}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {connected.length > 0 && (
          <div className="mt-6">
            <Button variant="cobalt" size="lg" onClick={() => nav('/app', { replace: true })}>
              Open inbox <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <ul className="mt-12 grid gap-6 border-t border-line pt-8 sm:grid-cols-3">
          {[
            [ShieldCheck, 'You approve everything', 'Replies are drafted for you and only go out after you approve them.'],
            [Sparkles, 'AI does the sorting', 'Each conversation gets a reply owner, a summary, and a reason.'],
            [Check, 'You can overrule it', 'Disagree with a label? Change it in one click and Relay keeps your choice.'],
          ].map(([Icon, t, d]) => (
            <li key={t}>
              <Icon className="h-5 w-5 text-ink-soft" aria-hidden />
              <h3 className="mt-3 text-[15px] font-semibold">{t}</h3>
              <p className="mt-1 text-sm leading-6 text-ink-mute">{d}</p>
            </li>
          ))}
        </ul>
        {me?.ai && (
          <p className="mt-10 text-xs text-ink-faint">
            AI: {me.ai.live ? `${me.ai.provider} (${me.ai.model})` : 'built-in demo engine'} · Storage: {me.ai.store}
          </p>
        )}
      </main>

      <Modal open={!!connecting} onClose={() => setConnecting(null)} title="Connect account" width="max-w-md">
        {connecting && <ConnectFlow provider={connecting} clientName={firstName(client)} onDone={finish} onCancel={() => setConnecting(null)} />}
      </Modal>
    </div>
  );
}