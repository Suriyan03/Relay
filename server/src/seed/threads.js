import { randomUUID } from 'node:crypto';
import { addDays, fmtMD, fmtWeekday, fmtDayMD, hoursAgo } from '../lib/time.js';

/**
 * Sample mailbox content used by the simulated Gmail / Outlook connections.
 * `expect` is only used by the offline test to measure classifier accuracy.
 * Placeholders: {cf} client first name, {c} client full name, {a} assistant first name,
 * {d+N} "Nov 19", {w+N} "Thursday", {dm+N} "Thu, Nov 19" (N days from now, IST).
 */

const GMAIL = [
  {
    key: 'series-b',
    subject: 'Revised term sheet – {c} Series B',
    with: 'Meera Iyer <meera.iyer@lumenventures.com>',
    unread: true,
    expect: 'client',
    messages: [
      {
        in: true,
        h: 2,
        b: `Hi {cf},\n\nFollowing yesterday's partner meeting, I've attached the revised term sheet. The two changes that matter: the pre-money valuation is now $42M, and we've moved to a board observer seat in place of a full seat.\n\nCould you confirm whether these terms work for you by {w+3}? We'd like to start legal drafting next week.\n\nBest,\nMeera`,
      },
    ],
  },
  {
    key: 'design-sync',
    subject: 'Reschedule: Product design sync',
    with: 'Dev Patel <dev.patel@northwindlabs.io>',
    unread: true,
    expect: 'assistant',
    messages: [
      {
        in: true,
        h: 5,
        b: `Hey,\n\nI need to move this week's product design sync. Could we do {dm+4} at 11:00 AM instead? Same room (Orion). Let me know if that works so I can update the invite.\n\nThanks,\nDev`,
      },
    ],
  },
  {
    key: 'orbit-msa',
    subject: 'Orbit Logistics MSA – signature required',
    with: 'Anita Rao <anita.rao@raolegal.in>',
    unread: true,
    expect: 'client',
    messages: [
      {
        in: true,
        h: 8,
        b: `Dear {cf},\n\nThe final MSA with Orbit Logistics is ready for execution. All our comments have been incorporated. Please review the signature pages and sign via DocuSign by {d+2}.\n\nDo tell me if you'd like to discuss clause 9 (liability cap) before signing.\n\nRegards,\nAnita Rao\nRao & Associates`,
      },
    ],
  },
  {
    key: 'offsite-venue',
    subject: 'Quote and availability – team offsite Dec 12–13',
    with: 'Riya Menon <bookings@orchardretreat.in>',
    unread: false,
    expect: 'assistant',
    messages: [
      {
        out: 'assistant',
        h: 50,
        b: `Hello,\n\nWe're planning a two-day team offsite for about 40 people on Dec 12–13 and would like to know your availability and per-person pricing.\n\nThanks,\n{a}`,
      },
      {
        in: true,
        h: 26,
        b: `Hi {a},\n\nThanks for your enquiry! We have availability on Dec 12–13. Our quote is attached: ₹1,850 per person including meals and the conference hall.\n\nTo hold the dates, could you confirm the final headcount and any dietary requirements by {d+4}?\n\nWarm regards,\nRiya`,
      },
    ],
  },
  {
    key: 'ph-weekly',
    subject: "This week's top launches on Product Hunt",
    with: 'Product Hunt <digest@producthunt.com>',
    unread: true,
    expect: 'none',
    messages: [
      {
        in: true,
        h: 20,
        b: `Your weekly digest\n\n1. Lattice AI – an assistant for spreadsheets\n2. Orbit Notes – meeting notes that write themselves\n3. Pulse – lightweight uptime monitoring\n\nYou're receiving this because you subscribed to Product Hunt Weekly. Unsubscribe or manage preferences at any time.`,
      },
    ],
  },
  {
    key: 'gh-build',
    subject: '[northwind/api] Run #482 succeeded',
    with: 'GitHub <notifications@github.com>',
    unread: false,
    expect: 'none',
    messages: [
      {
        in: true,
        h: 6,
        b: `Workflow "CI" run #482 succeeded on main.\n\nCommit: 3f9ac12 – Fix pagination bug in /v2/shipments\nDuration: 3m 41s\n\nYou are receiving this because you are watching this repository.`,
      },
    ],
  },
  {
    key: 'hire-rohan',
    subject: 'Approval needed: offer for Head of Sales (Rohan Desai)',
    with: 'Kavya Nair <kavya@northwindlabs.io>',
    unread: true,
    expect: 'client',
    messages: [
      {
        in: true,
        h: 4,
        b: `Hi {cf},\n\nRohan cleared all rounds and the panel unanimously recommends an offer. Proposed package: ₹68L fixed + 20% variable and 0.4% ESOP.\n\nThis is above the band we agreed, so I need your explicit approval before we send anything. Can you let me know today?\n\nKavya`,
      },
    ],
  },
  {
    key: 'press-ledger',
    subject: 'Interview request – founder profile',
    with: 'Tanvi Shah <tanvi.shah@theledger.news>',
    unread: true,
    expect: 'assistant',
    messages: [
      {
        in: true,
        h: 100,
        b: `Hi,\n\nI'm putting together a founder series for The Ledger and would love a 20-minute conversation with {cf} about the Northwind story. Would that be possible in the next two weeks?\n\nBest,\nTanvi Shah`,
      },
      {
        out: 'assistant',
        h: 96,
        b: `Hi Tanvi,\n\nThank you for reaching out. I'll check {cf}'s availability and get back to you shortly.\n\nBest,\n{a}`,
      },
      {
        in: true,
        h: 7,
        b: `Hi {a},\n\nJust following up. We close the issue on {d+5}, so I'd love to lock a slot this week if possible. Any update?\n\nThanks,\nTanvi`,
      },
    ],
  },
  {
    key: 'travel-quote',
    subject: 'Flight options – Bengaluru to Singapore, Dec 8',
    with: 'Skyline Travels <ops@skylinetravels.in>',
    unread: false,
    expect: 'none',
    messages: [
      {
        out: 'assistant',
        h: 52,
        b: `Hello team,\n\nPlease share business-class options from Bengaluru to Singapore departing Dec 8, returning Dec 11. Morning departures preferred.\n\nThanks,\n{a}\nExecutive Assistant to {c}`,
      },
    ],
  },
  {
    key: 'gst-figures',
    subject: 'Q3 GST filing – figures needed',
    with: 'Suresh Kulkarni <suresh@kulkarniassociates.in>',
    unread: false,
    expect: 'assistant',
    messages: [
      {
        in: true,
        h: 120,
        b: `Hi {cf},\n\nFor the Q3 GSTR-3B filing we still need the sales invoice summary and the ITC reconciliation. Could you share these by {w-1}?\n\nSuresh`,
      },
      {
        out: 'client',
        h: 72,
        b: `Hi Suresh, will send these over by end of week. Thanks for your patience.\n\n{cf}`,
      },
    ],
  },
  {
    key: 'lunch-karthik',
    subject: 'Accepted: Lunch with Karthik – {dm+1} 1:00 PM',
    with: 'Google Calendar <calendar-notification@google.com>',
    unread: false,
    expect: 'none',
    messages: [
      {
        in: true,
        h: 30,
        b: `Karthik Menon has accepted your invitation.\n\nLunch with Karthik\nWhen: {dm+1}, 1:00 PM – 2:00 PM IST\nWhere: Toit, Indiranagar\n\nInvitation from Google Calendar.`,
      },
    ],
  },
  {
    key: 'orbit-escalation',
    subject: 'Re: Dashboard outage – need to speak with you directly',
    with: 'Vikram Sethi <vikram.sethi@orbitlogistics.com>',
    unread: true,
    expect: 'client',
    messages: [
      {
        in: true,
        h: 60,
        b: `Hello,\n\nOur ops team couldn't access the tracking dashboard for three hours yesterday. This directly impacted dispatch for the morning shift.\n\nVikram`,
      },
      {
        out: 'assistant',
        h: 58,
        b: `Dear Vikram,\n\nWe sincerely apologise for the disruption. Our engineers have identified the root cause and a full post-mortem will reach you by {w+2}.\n\nRegards,\n{a}\nOn behalf of {c}`,
      },
      {
        in: true,
        h: 5,
        b: `Thanks, but this is the second incident this quarter. I'd like to hear from {cf} directly. My board is asking whether we should renew in January.\n\nCan we get 30 minutes on a call tomorrow?\n\nVikram`,
      },
    ],
  },
  {
    key: 'aws-invoice',
    subject: 'Your AWS invoice for October is available',
    with: 'Amazon Web Services <no-reply-aws@amazon.com>',
    unread: false,
    expect: 'none',
    messages: [
      {
        in: true,
        h: 40,
        b: `Hello,\n\nYour invoice for October 2026 is now available in the billing console. Total: $3,284.17.\n\nThis is an automated message, please do not reply to this email.`,
      },
    ],
  },
  {
    key: 'neha-resign',
    subject: 'Confidential – a conversation I would like to have',
    with: 'Neha Joshi <neha@northwindlabs.io>',
    unread: true,
    expect: 'client',
    messages: [
      {
        in: true,
        h: 9,
        b: `Hi {cf},\n\nI wanted to reach out to you personally before anyone else. After a lot of thought, I've decided to step down as VP Engineering. I'm committed to a thorough transition.\n\nCould we find time to talk privately this week? I'd prefer this stays between us for now.\n\nNeha`,
      },
    ],
  },
  {
    key: 'insurance',
    subject: 'Renewal documents – group health policy',
    with: 'Pooja Sharma <pooja@secureshield-insure.in>',
    unread: false,
    expect: 'assistant',
    messages: [
      {
        in: true,
        h: 30,
        b: `Hello,\n\nYour group health policy renews on {d+10}. To process the renewal we need:\n1. The updated employee list\n2. The signed proposal form\n3. A copy of the GST certificate\n\nPlease send these by {d+5}. Happy to help if anything is unclear.\n\nPooja Sharma\nSecureShield Insurance`,
      },
    ],
  },
  {
    key: 'expenses',
    subject: 'October expense reports – receipts pending',
    with: 'Aarti Verma <aarti@northwindlabs.io>',
    unread: false,
    expect: 'assistant',
    messages: [
      {
        in: true,
        h: 28,
        b: `Hi,\n\n{cf}'s October expense report is still missing receipts for 6 items (flights and two client dinners). Please upload the receipts to the finance portal by {d+2} so we can close the books.\n\nThanks,\nAarti`,
      },
    ],
  },
  {
    key: 'partnership',
    subject: 'Quick intro and a partnership idea',
    with: 'Gaurav Bhatia <gaurav@synergystack.io>',
    unread: true,
    expect: 'assistant',
    ambiguous: true,
    messages: [
      {
        in: true,
        h: 14,
        b: `Hi {cf},\n\nI lead partnerships at SynergyStack. We work with 200+ SaaS companies on co-marketing and I think there's something interesting between our teams.\n\nWould you be open to a quick chat next week to explore?\n\nGaurav`,
      },
    ],
  },
  {
    key: 'dinner-resolved',
    subject: 'Re: Reservation for 4 – Saturday',
    with: "Chef's Table <reservations@chefstable.in>",
    unread: false,
    expect: 'none',
    messages: [
      { in: true, h: 80, b: `Hello,\n\nConfirming a table for 4 on Saturday at 8:00 PM.\n\nChef's Table` },
      { out: 'assistant', h: 76, b: `Thank you! Could you please note a nut allergy for one guest?\n\n{a}` },
      { in: true, h: 70, b: `Noted. All set, see you on Saturday!\n\nChef's Table` },
    ],
  },
];

const OUTLOOK = [
  {
    key: 'qh-advisory',
    subject: 'Advisory agreement renewal – 2027',
    with: 'Dr. Sunita Rao <sunita.rao@quantumhealth.com>',
    unread: true,
    expect: 'client',
    messages: [
      {
        in: true,
        h: 11,
        b: `Dear {cf},\n\nYour advisory agreement with Quantum Health concludes on Dec 31. The board would like to continue and proposes a 12-month renewal on the same retainer.\n\nWould you be open to renewing? Please share your decision by {d+6} so we can prepare the paperwork.\n\nWarm regards,\nSunita`,
      },
    ],
  },
  {
    key: 'school-ptm',
    subject: 'Parent–teacher meeting – slot confirmation',
    with: 'Greenwood International School <office@greenwoodintl.edu.in>',
    unread: true,
    expect: 'assistant',
    messages: [
      {
        in: true,
        h: 16,
        b: `Dear Parent,\n\nThe Grade 5 parent–teacher meeting is on {dm+4}. Available slots: 4:30 PM, 5:00 PM, 5:30 PM.\n\nKindly reply with your preferred slot by {d+2}.\n\nFront Office\nGreenwood International School`,
      },
    ],
  },
  {
    key: 'bank-stmt',
    subject: 'Your October statement is ready',
    with: 'Meridian Bank <statements@meridianbank.com>',
    unread: false,
    expect: 'none',
    messages: [
      {
        in: true,
        h: 60,
        b: `Your account statement for October is now available to download from net banking.\n\nThis is a system-generated email. Please do not reply.`,
      },
    ],
  },
  {
    key: 'linkedin',
    subject: '{cf}, you appeared in 14 searches this week',
    with: 'LinkedIn <news@linkedin.com>',
    unread: true,
    expect: 'none',
    messages: [
      {
        in: true,
        h: 18,
        b: `See who's looking at your profile. 14 search appearances this week, 3 new followers.\n\nUnsubscribe from this email or update your notification settings.`,
      },
    ],
  },
  {
    key: 'dentist',
    subject: 'Appointment reminder – {dm+3}, 4:30 PM',
    with: 'Smile Dental Clinic <reminders@smiledental.in>',
    unread: false,
    expect: 'assistant',
    messages: [
      {
        in: true,
        h: 10,
        b: `Hello,\n\nThis is a reminder for {c}'s check-up on {dm+3} at 4:30 PM with Dr. Menon.\n\nReply C to confirm or R to reschedule.\n\nSmile Dental Clinic`,
      },
    ],
  },
  {
    key: 'advance-tax',
    subject: 'Advance tax – please confirm payment amount',
    with: 'Neelam Gupta <neelam@guptaca.in>',
    unread: true,
    expect: 'client',
    messages: [
      {
        in: true,
        h: 22,
        b: `Hi {cf},\n\nBased on projected income, the second advance tax instalment due on {d+9} comes to ₹4,20,000. Please confirm you're comfortable with this amount before we generate the challan.\n\nNeelam`,
      },
    ],
  },
  {
    key: 'teams-weekly',
    subject: 'Your weekly activity summary',
    with: 'Microsoft Teams <noreply@email.teams.microsoft.com>',
    unread: false,
    expect: 'none',
    messages: [
      {
        in: true,
        h: 36,
        b: `Here's what you missed this week: 12 chat messages, 3 mentions, 2 missed calls.\n\nTo stop receiving these summaries, unsubscribe in your Teams settings.`,
      },
    ],
  },
  {
    key: 'founders-dinner',
    subject: "Founders' Circle dinner – {dm+12}",
    with: 'Arvind Nambiar <arvind@founderscircle.in>',
    unread: true,
    expect: 'client',
    ambiguous: true,
    messages: [
      {
        in: true,
        h: 21,
        b: `Hi {cf},\n\nWe're hosting our quarterly dinner on {dm+12} at 7:30 PM at the Taj West End. Would love to have you join us, it's a great group and there's a fireside chat on fundraising.\n\nLet me know if you can make it!\n\nArvind`,
      },
    ],
  },
  {
    key: 'flight-conf',
    subject: 'Booking confirmed: Delhi to Bengaluru, {dm+8}',
    with: 'Skyline Air <booking@skylineair.com>',
    unread: false,
    expect: 'none',
    messages: [
      {
        in: true,
        h: 70,
        b: `Your booking is confirmed.\n\nPNR: K7QX2M\nFlight SA 412, Delhi to Bengaluru\nDeparture: {dm+8}, 07:15 AM\nArrival: 10:05 AM\n\nThis is an automated confirmation. Please do not reply.`,
      },
    ],
  },
  {
    key: 'property',
    subject: 'Sale deed – signatory clarification needed',
    with: 'Adv. R. Krishnan <krishnan@krishnanlaw.in>',
    unread: true,
    expect: 'client',
    messages: [
      {
        in: true,
        h: 7,
        b: `Dear {cf},\n\nWhile reviewing the sale deed for the Whitefield property we noticed the co-owner's name differs between the title documents and the draft.\n\nDo you want the deed to proceed in your sole name, or should your spouse be added as a co-purchaser? This needs your decision before registration on {d+7}.\n\nRegards,\nR. Krishnan`,
      },
    ],
  },
  {
    key: 'reno-quote',
    subject: 'Re: Quote – home office renovation',
    with: 'HomeCraft Interiors <hello@homecraftinteriors.in>',
    unread: false,
    expect: 'none',
    messages: [
      {
        in: true,
        h: 90,
        b: `Hello,\n\nThanks for the enquiry. We can visit the site on Saturday to take measurements.\n\nHomeCraft Interiors`,
      },
      {
        out: 'assistant',
        h: 40,
        b: `Saturday at 11 AM works well. Please share the quote and a rough timeline once you've seen the space.\n\nThanks,\n{a}`,
      },
    ],
  },
];

const SETS = { gmail: GMAIL, outlook: OUTLOOK };

export const seedExpectations = (provider) =>
  SETS[provider].map((t) => ({ key: t.key, expect: t.expect, ambiguous: !!t.ambiguous }));

export function render(str, ctx) {
  return str
    .replace(/\{cf\}/g, ctx.client.first)
    .replace(/\{c\}/g, ctx.client.name)
    .replace(/\{a\}/g, ctx.assistant.first)
    .replace(/\{(d|w|dm)([+-]\d+)\}/g, (_, kind, n) => {
      const date = addDays(ctx.now, Number(n));
      if (kind === 'd') return fmtMD(date);
      if (kind === 'w') return fmtWeekday(date);
      return fmtDayMD(date);
    });
}

export function parseAddr(s) {
  const m = /^(.*?)\s*<(.+)>$/.exec(s);
  return m ? { name: m[1].trim(), email: m[2].trim() } : { name: s, email: s };
}

export function mailboxFor(provider, client) {
  const first = client.first.toLowerCase().replace(/[^a-z]/g, '');
  const last = client.name.split(' ').slice(1).join('').toLowerCase().replace(/[^a-z]/g, '') || 'user';
  return provider === 'gmail' ? `${first}@northwindlabs.io` : `${first}.${last}@outlook.com`;
}

/** Shape of every stored conversation. */
export function blankThread({ workspaceId, accountId, provider, key = null, subject, counterpart, messages, unread = true, importLabel }) {
  const last = messages[messages.length - 1];
  return {
    _id: randomUUID(),
    workspaceId,
    accountId,
    provider,
    key,
    subject,
    counterpart,
    messages,
    lastMessageAt: last.at,
    unread,
    important: false,
    importantLocked: false,
    status: 'open',
    responsibility: null,
    override: null,
    needsReview: false,
    reviewed: false,
    ai: null,
    classifying: true,
    category: null,
    tags: { action: false, waiting: false, meeting: false },
    dates: [],
    meeting: null,
    suggestion: null,
    changedFrom: null,
    changedAt: null,
    clientAction: null,
    draft: null,
    activity: [{ at: new Date().toISOString(), actor: 'Relay', text: importLabel || 'Received' }],
    createdAt: new Date().toISOString(),
  };
}

/** Build raw (unclassified) thread documents for a provider. */
export function buildSeedThreads({ provider, workspaceId, accountId, client, assistant, now = new Date() }) {
  const ctx = { client, assistant, now };
  const mailbox = { name: client.name, email: mailboxFor(provider, client) };
  const defs = SETS[provider];
  return defs.map((def) => {
    const counterpart = parseAddr(def.with);
    const messages = def.messages.map((m, i) => {
      const at = hoursAgo(now, m.h).toISOString();
      const incoming = !!m.in;
      return {
        id: randomUUID(),
        from: incoming ? counterpart : mailbox,
        to: incoming ? mailbox : counterpart,
        at,
        body: render(m.b, ctx),
        direction: incoming ? 'in' : 'out',
        sentBy: incoming ? null : m.out,
      };
    });
    return {
      ...blankThread({
        workspaceId,
        accountId,
        provider,
        key: def.key,
        subject: render(def.subject, ctx),
        counterpart,
        messages,
        unread: !!def.unread,
        importLabel: `Imported from ${provider === 'gmail' ? 'Gmail' : 'Outlook'}`,
      }),
      _expect: def.expect,
    };
  });
}
