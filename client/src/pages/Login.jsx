import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, UserCog, UserRound, BellOff } from 'lucide-react';
import { api } from '../lib/api';
import { useSession } from '../context/Session.jsx';
import { Button, ErrorBanner, cx } from '../components/ui.jsx';
import { Logo, Chip } from '../components/badges.jsx';

const SAMPLE = [
  { from: 'Anita Rao', subject: 'Orbit Logistics MSA – signature required', owner: 'client', icon: UserRound, why: 'Needs Arjun’s personal signature.' },
  { from: 'Dev Patel', subject: 'Reschedule: Product design sync', owner: 'assistant', icon: UserCog, why: 'A scheduling request Sana can resolve.' },
  { from: 'GitHub', subject: '[northwind/api] Run #482 succeeded', owner: 'none', icon: BellOff, why: 'Automated notification, nothing to send.' },
];
const TONE = { client: 'marigold', assistant: 'cobalt', none: 'slate' };
const LABEL = { client: 'Client to reply', assistant: 'Assistant to reply', none: 'No reply needed' };

function Field({ label, type = 'text', value, onChange, autoComplete, placeholder, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-soft">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-line bg-white px-3.5 text-[15px] text-ink placeholder:text-ink-faint focus:border-cobalt-500 focus:outline-none focus:ring-2 focus:ring-cobalt-500/20"
      />
      {hint && <span className="mt-1 block text-xs text-ink-mute">{hint}</span>}
    </label>
  );
}

export default function Login() {
  const { session, signIn } = useSession();
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '', clientName: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  if (session) return <Navigate to="/app" replace />;

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy('form');
    try {
      const body = mode === 'login' ? { email: f.email, password: f.password } : f;
      const s = await api(`/auth/${mode === 'login' ? 'login' : 'signup'}`, { method: 'POST', body, auth: false });
      signIn(s);
      nav('/app', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  }

  async function demo() {
    setError(null);
    setBusy('demo');
    try {
      const s = await api('/auth/demo', { method: 'POST', auth: false });
      signIn(s);
      nav('/app', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Pitch panel */}
      <section className="relative hidden overflow-hidden bg-ink px-14 py-12 text-white lg:flex lg:flex-col">
        <Logo inverse />
        <div className="my-auto max-w-xl py-16">
          <h1 className="text-[44px] font-semibold leading-[1.08]">Every email has one person who should answer it. Relay tells you who.</h1>
          <p className="mt-5 max-w-md text-[17px] leading-7 text-white/65">
            Relay reads your client’s inbox and sorts each conversation by who needs to reply: you, your client, or nobody.
          </p>

          <ul className="mt-10 space-y-3" aria-label="Example conversations">
            {SAMPLE.map((s) => (
              <li key={s.subject} className="flex items-start gap-3 rounded-xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <span className={cx('mt-1 h-8 w-1 shrink-0 rounded-full', s.owner === 'client' ? 'bg-marigold-400' : s.owner === 'assistant' ? 'bg-cobalt-500' : 'bg-slate-500')} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/55">{s.from}</p>
                  <p className="truncate text-sm font-medium">{s.subject}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[13px] text-white/60">
                    <Sparkles className="h-3 w-3 text-orchid-200" aria-hidden /> {s.why}
                  </p>
                </div>
                <Chip tone={TONE[s.owner]} icon={s.icon}>{LABEL[s.owner]}</Chip>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/40">Prototype with simulated Gmail and Outlook connections.</p>
      </section>

      {/* Form panel */}
      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-[28px] font-semibold leading-tight">{mode === 'login' ? 'Welcome back' : 'Create your workspace'}</h2>
          <p className="mt-1.5 text-[15px] text-ink-mute">
            {mode === 'login' ? 'Sign in to manage your client’s inbox.' : 'You manage the inbox. Your client gets a simple page of their own.'}
          </p>

          <Button variant="primary" size="lg" className="mt-7 w-full" onClick={demo} loading={busy === 'demo'} icon={Sparkles}>
            Try the demo
          </Button>
          <p className="mt-2 text-center text-xs text-ink-mute">One click. Gives you a fresh private workspace with sample email.</p>

          <div className="my-6 flex items-center gap-3 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-line" /> or use your email <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode === 'signup' && (
              <>
                <Field label="Your name" value={f.name} onChange={set('name')} autoComplete="name" placeholder="Sana Kapoor" />
                <Field label="Client’s name" value={f.clientName} onChange={set('clientName')} placeholder="Arjun Mehta" hint="Whose inbox you manage." />
              </>
            )}
            <Field label="Email" type="email" value={f.email} onChange={set('email')} autoComplete="email" placeholder="you@company.com" />
            <Field label="Password" type="password" value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'signup' ? 'At least 6 characters' : ''} />
            {error && <ErrorBanner message={error} />}
            <Button type="submit" variant="secondary" size="lg" className="w-full" loading={busy === 'form'}>
              {mode === 'login' ? 'Sign in' : 'Create workspace'} <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-mute">
            {mode === 'login' ? 'New here?' : 'Already have a workspace?'}{' '}
            <button
              className="font-semibold text-cobalt-600 hover:underline"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
              }}
            >
              {mode === 'login' ? 'Create a workspace' : 'Sign in'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}