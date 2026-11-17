// Daily search queries, grouped by the brief's four purposes.
// The key becomes the item's `sectorId` hint for the writer ("portfolio",
// "regulation", "macro", or an M31 sector id for tech & funding).
// ~145 queries × 10 results × up to 3 sources → several hundred unique stories a day.

import { PORTFOLIO } from './portfolio.mjs';
import { BELLWETHERS } from './taxonomy.mjs';

export const RESULTS_PER_QUERY = 10;

export const QUERIES = {
  // 1. Portfolio — every company, by every name it goes by.
  portfolio: PORTFOLIO.flatMap((p) => p.aliases.map((a) => `"${a}"`)),

  // 1b. Bellwethers — big companies whose news moves our sectors (scandals, CEO changes, earnings, launches).
  bellwether: BELLWETHERS.flatMap((b) => [`${b} CEO`, `${b} shares`]),

  // 2. Regulation — rule changes in the industries M31 invests in.
  regulation: [
    'SEC crypto rule', 'CFTC crypto', 'crypto market structure bill', 'stablecoin regulation', 'bank charter crypto OCC',
    'AI regulation law', 'AI safety law state', 'EU AI Act', 'FDA guidance', 'drug pricing policy Medicare',
    'defense budget Congress', 'Pentagon acquisition reform', 'FCC spectrum satellite', 'nuclear regulatory commission',
    'export controls chips', 'antitrust Big Tech', 'cultivated meat ban', 'autonomous vehicle regulation',
  ],

  // 3. Tech breakthroughs and startup funding, by M31 sector.
  money: ['tokenized treasury fund', 'stablecoin payments launch'],
  defi: ['DeFi protocol launch', 'decentralized exchange volume'],
  web3: ['creator ownership platform', 'digital identity wallet'],
  ai: ['AI model release', 'AI agents breakthrough', 'AI chips new', 'AI scientific discovery'],
  robotics: ['humanoid robot', 'robotaxi expansion', 'industrial robotics'],
  defense: ['drone warfare technology', 'defense tech startup'],
  space: ['satellite launch new', 'space startup'],
  lifesci: ['gene therapy breakthrough', 'GLP-1 trial results', 'longevity research', 'brain-computer interface'],
  energy: ['fusion energy milestone', 'small modular reactor', 'battery breakthrough'],
  food: ['cultivated meat', 'precision fermentation', 'agtech'],
  deep: ['quantum computing breakthrough', 'cybersecurity breach'],
  vc: [
    'a16z leads round', 'Sequoia leads funding', 'Founders Fund leads', 'Paradigm crypto fund', 'General Catalyst leads',
    'Lightspeed leads', 'Khosla Ventures leads', 'Lux Capital leads', 'venture firm closes new fund', 'biggest funding rounds this week',
  ],

  // 5. Frontier — frontier science across biology, chemistry, physics and space (M31 hosts events here).
  frontier: [
    'first ever study scientists', 'in-space manufacturing assembly', 'rejuvenation study', 'gene editing first patient', 'synthetic biology breakthrough',
    'new material discovery', 'catalyst breakthrough', 'Nature study published', 'Science journal study', 'telescope discovery',
    'zero point energy', 'Casimir effect device', 'quantum vacuum energy', 'propellantless propulsion', 'Mach effect thruster',
    'electrostatic propulsion Exodus', 'warp drive metric engineering', 'Standard Model anomaly', 'beyond the Standard Model result',
    'room temperature superconductor', 'fifth force gravity experiment', 'UAP physics', '"Casimir Inc"', '"Harold White" Casimir',
  ],

  // 4. Macro — rates, inflation, growth, energy, geopolitics, markets.
  macro: [
    'Federal Reserve rates', 'CPI inflation', 'jobs report payrolls', 'Treasury yields', 'stock market today',
    'oil prices', 'Strait of Hormuz', 'dollar index', 'China economy trade', 'tariffs', 'bitcoin price',
  ],
};
