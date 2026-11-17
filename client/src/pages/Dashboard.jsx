import { useMemo, useState } from 'react';
import { LogOut, Search, Sparkles } from 'lucide-react';
import { useSession } from '../context/Session.jsx';
import { useData } from '../context/Data.jsx';
import { SEGMENTS, SEGMENT, FILTERS, sortByRecent } from '../lib/segments';
import { ThreadRow, ThreadRowSkeletons } from '../components/ThreadRow.jsx';
import { ThreadDetail } from '../components/ThreadDetail.jsx';
import { Logo, TONES } from '../components/badges.jsx';
import { Button, EmptyState, cx } from '../components/ui.jsx';
import { firstName, greeting, plural } from '../lib/format';
import { ShareLink } from '../components/ShareLink.jsx';
import { Notifications } from '../components/Notifications.jsx';
import { AccountsButton } from '../components/AccountsPanel.jsx';
import { ChatPanel } from '../components/ChatPanel.jsx';
import { SimulateButton } from '../components/SimulateButton.jsx';

const GROUPS = [
  { id: 'main', label: null },
  { id: 'owner', label: 'Who replies' },
  { id: 'organize', label: 'Organize' },
  { id: 'done', label: 'Done' },
];
const STATS = ['assistant', 'client', 'review', 'none'];

export default function Dashboard() {
  const { session, signOut } = useSession();
  const { threads, loaded, patchThread, me } = useData();
  const [seg, setSeg] = useState('inbox');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);

  const clientName = session.workspace?.clientName || 'your client';
  const counts = useMemo(
    () => Object.fromEntries(SEGMENTS.map((s) => [s.id, threads.filter(FILTERS[s.id]).length])),
    [threads],
  );
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return threads
      .filter(FILTERS[seg])
      .filter((t) => !needle || [t.subject, t.counterpart?.name, t.ai?.summary].some((v) => v?.toLowerCase().includes(needle)))
      .sort(sortByRecent);
  }, [threads, seg, q]);

  const selected = threads.find((t) => t._id === selId) || null;
  const current = SEGMENT[seg];

  function openThread(t) {
    setSelId(t._id);
    if (t.unread) patchThread(t._id, { unread: false });
  }
  // Used by the bell, the chat and the simulator: show it in the list too.
  function openById(id) {
    const t = threads.find((x) => x._id === id);
    if (!t) return;
    setSeg('inbox');
    setQ('');
    openThread(t);
  }
  function pick(id) {
    setSeg(id);
    setSelId(null);
  }

  return (
    <div className="flex h-dvh flex-col">
      {/* Top bar */}
      <header className="flex items-center gap-2 border-b border-line bg-white px-4 py-3 sm:gap-3">
        <Logo />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Button variant="ai" size="sm" icon={Sparkles} title="Ask Relay" aria-label="Ask Relay" onClick={() => setChatOpen(true)}>
            <span className="hidden xl:inline">Ask Relay</span>
          </Button>
          <SimulateButton onOpenThread={openById} />
          <Notifications onOpenThread={openById} />
          <AccountsButton clientName={clientName} />
          <ShareLink clientName={clientName} initialToken={me?.workspace?.inviteToken} />
          <Button variant="ghost" size="sm" icon={LogOut} onClick={signOut}>Sign out</Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="scroll-thin hidden w-64 shrink-0 overflow-y-auto border-r border-line bg-white px-3 py-4 lg:block">
          {GROUPS.map((g) => (
            <div key={g.id} className="mb-4">
              {g.label && <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">{g.label}</p>}
              {SEGMENTS.filter((s) => s.group === g.id).map((s) => (
                <button
                  key={s.id}
                  onClick={() => pick(s.id)}
                  aria-current={seg === s.id ? 'page' : undefined}
                  className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors', seg === s.id ? 'bg-slate-900/5 font-semibold text-ink' : 'text-ink-soft hover:bg-slate-900/5')}
                >
                  <s.icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1 truncate">{s.label}</span>
                  <span className="text-xs tabular-nums text-ink-mute">{counts[s.id]}</span>
                </button>
              ))}
            </div>
          ))}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {/* Greeting + stats (hidden while a thread is open on small screens) */}
          <div className={cx('border-b border-line bg-white px-5 py-4', selected && 'hidden lg:block')}>
            <h1 className="text-xl font-semibold">
              {greeting()}, {firstName(session.user.name)}
            </h1>
            <p className="text-sm text-ink-mute">
              {counts.assistant === 0 ? `Nothing needs you right now.` : `${plural(counts.assistant, 'conversation')} waiting for your reply for ${firstName(clientName)}.`}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STATS.map((id) => {
                const s = SEGMENT[id];
                const tone = TONES[s.tone];
                return (
                  <button
                    key={id}
                    onClick={() => pick(id)}
                    className={cx('rounded-xl border px-3 py-2.5 text-left transition-shadow hover:shadow-lift', tone.soft, tone.border, seg === id && 'ring-2 ring-ink/20')}
                  >
                    <p className={cx('text-2xl font-semibold tabular-nums', tone.text)}>{counts[id]}</p>
                    <p className="truncate text-xs text-ink-soft">{s.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile segment chips */}
          <div className={cx('no-scrollbar flex gap-1.5 overflow-x-auto border-b border-line bg-white px-4 py-2 lg:hidden', selected && 'hidden')}>
            {SEGMENTS.map((s) => (
              <button key={s.id} onClick={() => pick(s.id)} className={cx('whitespace-nowrap rounded-full px-3 py-1.5 text-sm', seg === s.id ? 'bg-ink text-white' : 'bg-white text-ink-soft ring-1 ring-line')}>
                {s.short} {counts[s.id]}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1">
            {/* List */}
            <section className={cx('min-w-0 flex-col border-r border-line bg-white lg:flex lg:w-[400px] lg:flex-none', selected ? 'hidden' : 'flex flex-1')}>
              <div className="border-b border-line-soft px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-base font-semibold">{current.label}</h2>
                  <span className="text-xs text-ink-mute">{plural(list.length, 'conversation')}</span>
                </div>
                <label className="relative mt-2 block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search subject, sender or summary"
                    className="h-9 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm placeholder:text-ink-faint focus:border-cobalt-500 focus:outline-none focus:ring-2 focus:ring-cobalt-500/20"
                  />
                </label>
              </div>
              <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
                {!loaded ? (
                  <ThreadRowSkeletons />
                ) : list.length === 0 ? (
                  <EmptyState icon={current.icon} title={q ? 'No matches' : 'All clear'} body={q ? 'Try a different search.' : current.empty} />
                ) : (
                  list.map((t) => <ThreadRow key={t._id} thread={t} selected={t._id === selId} onClick={() => openThread(t)} clientName={clientName} />)
                )}
              </div>
            </section>

            {/* Detail */}
            <section className={cx('min-w-0 flex-1 flex-col bg-canvas lg:flex', selected ? 'flex' : 'hidden')}>
              <ThreadDetail thread={selected} onBack={() => setSelId(null)} />
            </section>
          </div>
        </main>
      </div>

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} thread={selected} clientName={clientName} onOpenThread={openById} />
    </div>
  );
}