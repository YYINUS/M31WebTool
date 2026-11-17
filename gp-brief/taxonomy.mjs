// M31's current sector + incumbent taxonomy, mirrored from
//   lib/constants.ts            (SECTORS: ids, labels, colors)
//   data/current-paradigms.ts   (incumbent systems: status + stress score)
// Kept as plain JS so the brief builder runs with `node` and no build step.
// If either source file changes, update this file to match.

export const SECTORS = [
  { id: 'money',    label: 'Digital Money & Reserve Assets', color: '#b45309', paradigms: ['bitcoin', 'rwa'] },
  { id: 'defi',     label: 'Decentralized Finance',          color: '#7c3aed', paradigms: ['defi'] },
  { id: 'web3',     label: 'Web3 & Ownership',               color: '#db2777', paradigms: ['web3'] },
  { id: 'ai',       label: 'AI Systems',                     color: '#1d4ed8', paradigms: ['web3ai', 'aiagents'] },
  { id: 'robotics', label: 'Robotics & Autonomy',            color: '#0369a1', paradigms: ['humanoid', 'av'] },
  { id: 'defense',  label: 'Defense',                        color: '#166534', paradigms: ['defense'] },
  { id: 'space',    label: 'Space & Satellite',              color: '#4338ca', paradigms: ['space', 'satbroadband'] },
  { id: 'lifesci',  label: 'Healthcare & Life Sciences',     color: '#0f766e', paradigms: ['funcmed', 'peptides', 'wholeperson', 'psychedelics', 'crispr', 'longevity', 'glp1', 'immunotherapy', 'aidrugdisc', 'bci', 'microbiome', 'mentalhealth', 'healthdata', 'synbio', 'xenotransplant'] },
  { id: 'energy',   label: 'Energy & Grid',                  color: '#991b1b', paradigms: ['nuclear', 'fusion', 'solidstate', 'carboncapture', 'decenergy'] },
  { id: 'food',     label: 'Food & Agriculture',             color: '#15803d', paradigms: ['altprotein', 'agtech'] },
];

// Sectors M31 still tracks but that are not on the Current Paradigms board.
// Their news can appear only as a one-line "Beyond the core sectors" note.
export const OUTSIDE_SECTORS = [
  { id: 'deep',     label: 'Deep Tech',        paradigms: ['quantum', 'cybersec'] },
  { id: 'frontier', label: 'Frontier Physics', paradigms: ['zpe', 'advpropulsion'] },
];

export const INCUMBENTS = [
  { id: 'fiat',          name: 'Fiat Monetary System',          sectorId: 'money',    status: 'breaking', stress: 7.8 },
  { id: 'banking',       name: 'Banking Intermediation',        sectorId: 'defi',     status: 'stressed', stress: 6.5 },
  { id: 'platforms',     name: 'Platform Gatekeepers',          sectorId: 'web3',     status: 'stressed', stress: 5.8 },
  { id: 'centralizedai', name: 'Centralized AI Platforms',      sectorId: 'ai',       status: 'stable',   stress: 2.8 },
  { id: 'humanlabor',    name: 'Human-Dependent Labor Economy', sectorId: 'robotics', status: 'breaking', stress: 8.2 },
  { id: 'legacydefense', name: 'Legacy Defense Primes',         sectorId: 'defense',  status: 'stressed', stress: 6.8 },
  { id: 'closedspace',   name: 'Government-Gated Space Access', sectorId: 'space',    status: 'breaking', stress: 8.5 },
  { id: 'sickcare',      name: 'Sick Care System',              sectorId: 'lifesci',  status: 'breaking', stress: 7.8 },
  { id: 'insurance',     name: 'Insurance Intermediation',      sectorId: 'lifesci',  status: 'stressed', stress: 6.2 },
  { id: 'pharmard',      name: 'Trial-and-Error Pharma R&D',    sectorId: 'lifesci',  status: 'stressed', stress: 5.5 },
  { id: 'fossilfuels',   name: 'Fossil Fuel Energy System',     sectorId: 'energy',   status: 'stressed', stress: 4.5 },
  { id: 'industrialag',  name: 'Industrial Animal Agriculture', sectorId: 'food',     status: 'stressed', stress: 6.0 },
];

export const ALL_PARADIGMS = new Set([...SECTORS, ...OUTSIDE_SECTORS].flatMap((s) => s.paradigms));

export const sectorById = (id) => SECTORS.find((s) => s.id === id);
export const incumbentById = (id) => INCUMBENTS.find((i) => i.id === id);

export function sectorForParadigm(paradigmId) {
  return [...SECTORS, ...OUTSIDE_SECTORS].find((s) => s.paradigms.includes(paradigmId));
}

// Same badge colors as the Current Paradigms board.
export const STATUS_STYLE = {
  breaking: { label: 'BREAKING', fg: '#991b1b', bg: '#fee2e2' },
  stressed: { label: 'STRESSED', fg: '#92400e', bg: '#fef3c7' },
  stable:   { label: 'STABLE',   fg: '#166534', bg: '#dcfce7' },
};

// What today's news did to an incumbent, in plain words.
export const MOVE_STYLE = {
  'stress-rising': { label: 'Stress rising', arrow: '▲', fg: '#991b1b' },
  'defending':     { label: 'Defending',     arrow: '■', fg: '#1e3a5f' },
  'adapting':      { label: 'Adapting',      arrow: '◆', fg: '#92400e' },
  'easing':        { label: 'Stress easing', arrow: '▼', fg: '#166534' },
  'mixed':         { label: 'Mixed',         arrow: '◇', fg: '#525252' },
};

// BELLWETHERS — companies whose news moves M31's sectors even though M31 does
// not own them. Searched every day so a scandal, earnings shock or big launch
// never reaches the brief only by accident.
export const BELLWETHERS = [
  'Nvidia', 'OpenAI', 'Anthropic', 'Microsoft', 'Google', 'Meta', 'Apple', 'Amazon', 'Tesla', 'TSMC',
  'Coinbase', 'BlackRock', 'Circle', 'Tether', 'Strategy MicroStrategy', 'Lockheed Martin', 'Palantir', 'Eli Lilly', 'Novo Nordisk',
];

// Major VCs whose rounds, fund closes and reports go in "Money moves".
export const VC_WATCHLIST = [
  'a16z', 'Sequoia', 'Founders Fund', 'Paradigm', 'General Catalyst', 'Lightspeed', 'Thrive Capital', 'Khosla Ventures',
  'Lux Capital', '8VC', 'Index Ventures', 'Accel', 'Greylock', 'Kleiner Perkins', 'Coatue', 'Tiger Global',
  'Pantera', 'Polychain', 'Multicoin', 'Haun Ventures', 'Dragonfly', 'Breakthrough Energy Ventures', 'ARCH Venture Partners',
];
