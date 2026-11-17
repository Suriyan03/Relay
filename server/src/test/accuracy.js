import { buildSeedThreads } from '../seed/threads.js';
import { analyzeWithRules } from '../ai/heuristics.js';

const client = { name: 'Arjun Mehta', first: 'Arjun' };
const assistant = { name: 'Sana Kapoor', first: 'Sana' };
let ok = 0, total = 0;
const rows = [];
for (const provider of ['gmail', 'outlook']) {
  const threads = buildSeedThreads({ provider, workspaceId: 'w', accountId: 'a', client, assistant });
  for (const t of threads) {
    const a = analyzeWithRules(t, { now: new Date() });
    total++;
    const pass = a.responsibility === t._expect;
    if (pass) ok++;
    rows.push(`${pass ? 'ok  ' : 'MISS'} ${t.key.padEnd(18)} want=${t._expect.padEnd(9)} got=${a.responsibility.padEnd(9)} conf=${a.confidence.toFixed(2)} ${a.confidence < 0.7 ? 'REVIEW ' : '       '} act=${a.tags.actionRequired ? 'Y' : '-'} wait=${a.tags.waitingForResponse ? 'Y' : '-'} mtg=${a.tags.meeting ? 'Y' : '-'} imp=${a.tags.important ? 'Y' : '-'} cat=${a.category} dates=${a.dates.length}`);
  }
}
console.log(rows.join('\n'));
console.log(`\n${ok}/${total} correct`);
