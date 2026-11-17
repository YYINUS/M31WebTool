// M31's PUBLIC THESES — what the firm has said in its own writing
// (m31capital.substack.com). The "M31 Thesis" section of the brief tests
// today's news against these calls: does it confirm, contradict, or complicate
// what we said in public? Evidence against us is shown as readily as evidence for.
//
// Update when a new essay is published. `claim` is our wording, condensed;
// `watch` lists what to look for in the news.

export const THESES = [
  { id: 'spiritual-warfare', title: 'Spiritual Warfare', date: '2026-11-04',
    url: 'https://m31capital.substack.com/p/spiritual-warfare',
    claim: 'Frontier tech has become a national-security contest that will be settled by sudden executive action, not markets. Expect policy shocks and a premium on assets no state can seize.',
    watch: 'espionage, state action against AI labs or chipmakers, export controls, nationalization, sovereign compute, Bitcoin as seizure-resistant asset' },
  { id: 'clarity', title: "Crypto's Moment of Clarity", date: '2025-12-01',
    url: 'https://m31capital.substack.com/p/cryptos-moment-of-clarity',
    claim: 'The CLARITY Act passes the Senate in early 2026 and opens the door for institutions to buy tokens; regulated markets reward tokens with real revenue.',
    watch: 'CLARITY Act, market-structure bill, institutional token allocation, token revenue and buybacks' },
  { id: 'market-regime', title: 'The New Market Regime', date: '2026-01-06',
    url: 'https://m31capital.substack.com/p/the-new-market-regime',
    claim: 'Altcoin weakness is structural, not cyclical: liquidity never came back after 2022, and nothing changes until regulation does.',
    watch: 'altcoin liquidity, market depth, token unlocks, crypto market makers' },
  { id: 'atomic-turn', title: 'The Atomic Turn', date: '2026-05-07',
    url: 'https://m31capital.substack.com/p/the-atomic-turn',
    claim: 'The Hormuz closure put the oil-based energy system in crisis; chokepoints speed the shift to nuclear and distributed energy.',
    watch: 'Hormuz, oil supply shocks, nuclear and SMR deals, AI data-center power, solar' },
  { id: 'populist-1873', title: 'AI & the Populist Rise of 1873', date: '2026-05-29',
    url: 'https://m31capital.substack.com/p/artificial-intelligence-and-the-populist',
    claim: 'The AI capex boom runs on money that is too loose; savers lose to debasement and sovereigns rotate into Bitcoin and gold (70%: another G20 country announces a Bitcoin position by end-2027).',
    watch: 'real yields, Fed policy, dollar reserve share, sovereign Bitcoin purchases, gold buying by central banks, AI capex' },
  { id: 'heresy', title: 'The High Cost of Heresy', date: '2026-07-14',
    url: 'https://m31capital.substack.com/p/the-high-cost-of-heresy',
    claim: 'Institutional resistance is a signal of how much an idea threatens incumbents; psychedelics and Bitcoin followed the same arc from banned to vindicated.',
    watch: 'psilocybin and psychedelic approvals, FDA, incumbent pushback against challengers' },
  { id: 'holy-war', title: 'A Holy War Is Coming', date: '2026-06-24',
    url: 'https://m31capital.substack.com/p/a-holy-war-is-coming',
    claim: 'Society is splitting over how humans should become greater — natural cultivation versus re-engineering (GLP-1s, CRISPR, AI, enhancement).',
    watch: 'Enhanced Games, gene editing, GLP-1, longevity, human enhancement backlash' },
  { id: 'hidden-grammar', title: 'The Hidden Grammar of History', date: '2026-05-14',
    url: 'https://m31capital.substack.com/p/the-hidden-grammar-of-history',
    claim: 'Big technology shifts overturn existing power structures; fiat quietly transfers wealth and Bitcoin restores sound money.',
    watch: 'power shifts from incumbents, monetary debasement' },
];

export const thesisById = (id) => THESES.find((t) => t.id === id);

export const VERDICTS = {
  confirms:    { label: 'Confirms',    fg: '#166534', bg: '#dcfce7' },
  contradicts: { label: 'Contradicts', fg: '#991b1b', bg: '#fee2e2' },
  mixed:       { label: 'Mixed',       fg: '#92400e', bg: '#fef3c7' },
};
