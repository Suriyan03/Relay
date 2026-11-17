import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, FileText, Mail } from 'lucide-react';
import { api } from '../lib/api';
import { useData } from '../context/Data.jsx';
import { useToast } from '../context/Toast.jsx';
import { Button, Sheet, Spinner, cx } from './ui.jsx';
import { firstName } from '../lib/format';

export function ChatPanel({ open, onClose, thread, clientName, onOpenThread }) {
  const { threads, patchThread } = useData();
  const { toast } = useToast();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const client = firstName(clientName);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, busy, open]);

  const starters = thread
    ? ['Summarize this conversation', 'Why was this assigned?', 'Draft a reply to this conversation']
    : [`Which emails require ${client}'s attention?`, 'What am I waiting on?', 'Any upcoming meetings?', 'Give me an overview'];

  async function ask(q) {
    const message = (q ?? text).trim();
    if (!message || busy) return;
    const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((x) => [...x, { role: 'user', text: message }]);
    setText('');
    setBusy(true);
    try {
      const r = await api('/chat', { method: 'POST', body: { message, history, threadId: thread?._id } });
      setMsgs((x) => [...x, { role: 'assistant', text: r.answer, threadIds: r.threadIds || [], draft: r.draft, draftFor: thread?._id, source: r.source }]);
    } catch (e) {
      setMsgs((x) => [...x, { role: 'assistant', text: e.message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  async function applyDraft(m) {
    const t = threads.find((x) => x._id === m.draftFor);
    if (!t) return;
    const saved = await patchThread(t._id, { draft: { body: m.draft, voice: t.responsibility === 'client' ? 'client' : 'assistant' } });
    if (saved) {
      onOpenThread(t._id);
      onClose();
      toast({ title: 'Draft added to the reply box', description: 'Read it through before you send.' });
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      width="sm:max-w-[480px]"
      title={
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-orchid-500" aria-hidden /> Ask Relay
        </h2>
      }
      subtitle={<p className="truncate text-[13px] text-ink-mute">{thread ? `Looking at "${thread.subject}"` : `Questions about ${client}'s inbox`}</p>}
      footer={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
          className="flex gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={600}
            placeholder={thread ? 'Ask about this conversation...' : 'Ask about the inbox...'}
            className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm placeholder:text-ink-faint focus:border-cobalt-500 focus:outline-none focus:ring-2 focus:ring-cobalt-500/20"
          />
          <Button type="submit" variant="ai" icon={Send} disabled={!text.trim() || busy}>Ask</Button>
        </form>
      }
    >
      <div className="space-y-4 px-5 py-5">
        {msgs.length === 0 && (
          <div>
            <p className="text-sm leading-6 text-ink-soft">Ask about {client}'s inbox. Answers come only from the emails Relay has sorted.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {starters.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-full bg-white px-3 py-1.5 text-[13px] text-ink-soft ring-1 ring-line hover:bg-slate-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm leading-6 text-white">{m.text}</p>
            </div>
          ) : (
            <div key={i} className="space-y-2">
              <div className={cx('max-w-[92%] rounded-2xl rounded-bl-md border px-4 py-3 text-sm leading-6', m.error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-line bg-white text-ink')}>
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>

              {m.threadIds?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.threadIds.map((id) => {
                    const t = threads.find((x) => x._id === id);
                    if (!t) return null;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          onOpenThread(id);
                          onClose();
                        }}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-slate-900/5 px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-slate-900/10"
                      >
                        <Mail className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">{t.subject}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {m.draft && (
                <div className="rounded-xl border border-orchid-200 bg-orchid-50 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-orchid-700">
                    <FileText className="h-3.5 w-3.5" aria-hidden /> Draft reply
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-6 text-ink-soft">{m.draft}</p>
                  {m.draftFor && (
                    <Button size="sm" variant="ai" className="mt-3" onClick={() => applyDraft(m)}>
                      Use as reply draft
                    </Button>
                  )}
                </div>
              )}

              {m.source && <p className="text-[11px] text-ink-faint">{m.source === 'llm' ? 'Answered by the AI model' : 'Answered by the built-in demo engine'}</p>}
            </div>
          ),
        )}

        {busy && (
          <p className="flex items-center gap-2 text-sm text-ink-mute">
            <Spinner className="h-4 w-4" /> Thinking...
          </p>
        )}
        <div ref={endRef} />
      </div>
    </Sheet>
  );
}