import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, PenLine, Trash2 } from 'lucide-react';
import { Button, cx } from './ui';
import { useData } from '../context/Data.jsx';
import { useSession } from '../context/Session.jsx';
import { useToast } from '../context/Toast.jsx';
import { firstName } from '../lib/format';

const TONES = [
  ['professional', 'Professional'],
  ['warm', 'Warm'],
  ['brief', 'Brief'],
];

function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-slate-900/5 p-1">
      {options.map(([id, text]) => (
        <button
          key={id}
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={cx('rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors', value === id ? 'bg-white text-ink shadow-sm' : 'text-ink-mute hover:text-ink')}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function ReplyComposer({ thread: t, onSent }) {
  const { patchThread, threadAction } = useData();
  const { session } = useSession();
  const { toast } = useToast();
  const assistantName = firstName(session.user.name);
  const clientName = firstName(session.workspace?.clientName || 'Client');

  const [open, setOpen] = useState(!!t.draft);
  const [body, setBody] = useState(t.draft?.body || '');
  const [voice, setVoice] = useState(t.draft?.voice || (t.responsibility === 'client' ? 'client' : 'assistant'));
  const [tone, setTone] = useState(t.draft?.tone || 'professional');
  const [instruction, setInstruction] = useState(t.draft?.instruction || '');
  const [expectReply, setExpectReply] = useState(true);
  const [busy, setBusy] = useState(null);
    const bodyRef = useRef(body);
  bodyRef.current = body;

  // Reset when another conversation is opened or a new AI draft arrives.
  useEffect(() => {
    setOpen(!!t.draft);
    setBody(t.draft?.body || '');
    setVoice(t.draft?.voice || (t.responsibility === 'client' ? 'client' : 'assistant'));
    setTone(t.draft?.tone || 'professional');
    setInstruction(t.draft?.instruction || '');
    setExpectReply(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t._id, t.draft?.generatedAt]);
    // A draft pasted in from elsewhere (e.g. the Ask Relay chat) should show up in the box.
  useEffect(() => {
    const d = t.draft;
    if (d && d.body !== bodyRef.current) {
      setBody(d.body);
      if (d.voice) setVoice(d.voice);
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.draft?.savedAt]);

  async function generate() {
    setBusy('draft');
    const r = await threadAction(t._id, 'draft', { voice, tone, instruction });
    setBusy(null);
    if (r) setOpen(true);
  }

  function saveDraft() {
    if (body.trim() && body !== (t.draft?.body || '')) patchThread(t._id, { draft: { body, voice } });
  }

  async function discard() {
    await patchThread(t._id, { draft: null });
    setBody('');
    setOpen(false);
  }

  async function send() {
    setBusy('send');
    const r = await threadAction(t._id, 'send', { body, voice, expectReply });
    setBusy(null);
    if (r) {
      toast({ title: 'Reply approved and sent', description: expectReply ? 'Now waiting for a response.' : 'Marked as completed.' });
      onSent?.(expectReply);
    }
  }

  if (!open) {
    return (
      <section className="rounded-xl border border-line bg-white p-4">
        <h3 className="text-sm font-semibold">Reply</h3>
        <p className="mt-1 text-sm text-ink-mute">Let the AI write a first draft, or write your own. Nothing is sent until you approve it.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ai" icon={Sparkles} loading={busy === 'draft'} onClick={generate}>Draft with AI</Button>
          <Button icon={PenLine} onClick={() => setOpen(true)}>Write my own</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h3 className="text-sm font-semibold">Reply</h3>
        <Segmented
          label="Send as"
          value={voice}
          onChange={setVoice}
          options={[
            ['assistant', `As ${assistantName}`],
            ['client', `As ${clientName}`],
          ]}
        />
        <Segmented label="Tone" value={tone} onChange={setTone} options={TONES} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          maxLength={400}
          placeholder="Optional: tell the AI what to say (e.g. ask to move it to Thursday)"
          className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm placeholder:text-ink-faint focus:border-cobalt-500 focus:outline-none focus:ring-2 focus:ring-cobalt-500/20"
        />
        <Button variant="ai" icon={Sparkles} loading={busy === 'draft'} onClick={generate}>
          {t.draft ? 'Redraft' : 'Draft'}
        </Button>
      </div>

      <label className="mt-3 block">
        <span className="sr-only">Reply text</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={saveDraft}
          rows={9}
          placeholder="Write your reply here..."
          className="w-full resize-y rounded-lg border border-line bg-white px-3.5 py-3 text-[14.5px] leading-6 text-ink placeholder:text-ink-faint focus:border-cobalt-500 focus:outline-none focus:ring-2 focus:ring-cobalt-500/20"
        />
      </label>
      {t.draft?.generatedAt && <p className="mt-1.5 text-xs text-ink-mute">AI draft. Read it through and edit before you send.</p>}

      <label className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={expectReply} onChange={(e) => setExpectReply(e.target.checked)} className="h-4 w-4 rounded border-line" />
        I expect a response (keeps this open as “Waiting”). Untick to mark it completed.
      </label>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="ghost" icon={Trash2} onClick={discard} disabled={busy === 'send'}>Discard</Button>
        <Button variant="cobalt" icon={Send} loading={busy === 'send'} disabled={body.trim().length < 2} onClick={send}>
          Approve and send
        </Button>
      </div>
      <p className="mt-2 text-right text-xs text-ink-faint">Prototype: the reply is added to the thread. No real email is sent.</p>
    </section>
  );
}