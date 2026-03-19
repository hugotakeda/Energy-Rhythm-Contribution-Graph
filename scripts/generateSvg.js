// @ts-check
'use strict';

const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const USERNAME = process.env.GITHUB_USERNAME || process.argv[2];
const TOKEN    = process.env.GITHUB_TOKEN    || process.argv[3];

if (!USERNAME || !TOKEN) {
  console.error('Usage: node scripts/generateSvg.js <username> <token>');
  console.error('  or set GITHUB_USERNAME and GITHUB_TOKEN env vars');
  process.exit(1);
}

// ── Energy State ──────────────────────────────────────────────────────────────
const STATES = {
  none:       { label: 'No commits',         color: '#161b22', glow: 'none' },
  madrugada:  { label: 'Night Owl 🌙',        color: '#7c3aed', glow: '#7c3aed' },
  manha:      { label: 'Early Bird ☕',        color: '#ca8a04', glow: '#ca8a04' },
  tarde:      { label: 'Peak Hours ☀️',       color: '#ea580c', glow: '#ea580c' },
  noite:      { label: 'Deep Focus 🕯️',       color: '#0891b2', glow: '#0891b2' },
};

function getEnergyState(hour) {
  if (hour >= 0  && hour <  6)  return 'madrugada';
  if (hour >= 6  && hour < 12)  return 'manha';
  if (hour >= 12 && hour < 18)  return 'tarde';
  return 'noite';
}

function getOpacity(count) {
  if (count === 0) return 1;
  if (count <= 2)  return 0.45;
  if (count <= 5)  return 0.70;
  if (count <= 9)  return 0.88;
  return 1;
}

// ── Fetch GitHub commits ───────────────────────────────────────────────────────
async function fetchCommits(username, token) {
  const since = new Date();
  since.setDate(since.getDate() - 365);

  const query = `
    query($username: String!, $since: GitTimestamp!) {
      user(login: $username) {
        repositories(first: 100, isFork: false, ownerAffiliations: [OWNER, COLLABORATOR], orderBy: {field: PUSHED_AT, direction: DESC}) {
          nodes {
            defaultBranchRef {
              target {
                ... on Commit {
                  history(since: $since, first: 100) {
                    nodes {
                      committedDate
                      author { user { login } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables: { username, since: since.toISOString() } }),
  });

  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);

  const { data, errors } = await res.json();
  if (errors) throw new Error('GraphQL errors: ' + errors.map(e => e.message).join(', '));

  const commits = [];
  for (const repo of data.user.repositories.nodes) {
    const nodes = repo?.defaultBranchRef?.target?.history?.nodes || [];
    for (const node of nodes) {
      if (node.author?.user?.login?.toLowerCase() === username.toLowerCase()) {
        commits.push(node.committedDate);
      }
    }
  }
  return commits;
}

// ── Build daily energy map ─────────────────────────────────────────────────────
function buildDayMap(commitDates) {
  // Initialize 365 days
  const map = new Map();
  for (let i = 364; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    map.set(key, { date: key, total: 0, details: { madrugada: 0, manha: 0, tarde: 0, noite: 0 } });
  }

  // Fill commits
  for (const iso of commitDates) {
    const d    = new Date(iso);
    const key  = d.toISOString().split('T')[0];
    const hour = d.getUTCHours();
    const state = getEnergyState(hour);
    if (map.has(key)) {
      map.get(key).total++;
      map.get(key).details[state]++;
    }
  }

  // Determine predominant state
  const days = Array.from(map.values());
  for (const day of days) {
    if (day.total === 0) {
      day.state = 'none';
    } else {
      day.state = Object.entries(day.details).reduce((a, b) => b[1] > a[1] ? b : a)[0];
    }
  }

  return days;
}

// ── SVG dimensions ─────────────────────────────────────────────────────────────
const CELL     = 11;
const GAP      = 3;
const STEP     = CELL + GAP;
const TOP_PAD  = 28;   // room for month labels
const LEFT_PAD = 0;
const COLS     = 53;
const ROWS     = 7;
const WIDTH    = LEFT_PAD + COLS * STEP + 2;
const HEIGHT   = TOP_PAD + ROWS * STEP + 60; // +60 for legend

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Build SVG ──────────────────────────────────────────────────────────────────
function buildSvg(days) {
  // align to full weeks
  const today    = new Date();
  const startDow = (today.getDay() + 1) % 7; // 0=Sun grid starts Sunday

  // Pad front so Day 0 lands on correct weekday
  const firstDate   = new Date(days[0].date);
  const firstDow    = firstDate.getDay(); // 0=Sun
  const paddedDays  = [...Array(firstDow).fill(null), ...days];

  // chunk into weeks (columns)
  const weeks = [];
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7));
  }

  // – month labels –
  const monthLabels = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const firstReal = week.find(Boolean);
    if (!firstReal) return;
    const m = new Date(firstReal.date).getMonth();
    if (m !== lastMonth) {
      lastMonth = m;
      monthLabels.push({ x: LEFT_PAD + wi * STEP, label: MONTHS[m] });
    }
  });

  // – cells –
  const cells = [];
  const animDefs = [];

  weeks.forEach((week, wi) => {
    week.forEach((day, di) => {
      if (!day) return;
      const x     = LEFT_PAD + wi * STEP;
      const y     = TOP_PAD + di * STEP;
      const state = day.state;
      const cfg   = STATES[state];
      const op    = getOpacity(day.total);
      const hasGlow = day.total > 5 && state !== 'none';

      // animated glow filter id
      const filterId = `glow-${wi}-${di}`;

      if (hasGlow) {
        animDefs.push(`
  <filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="2.5" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`);
      }

      const fillColor = state === 'none' ? cfg.color : cfg.color;
      const filterAttr = hasGlow ? ` filter="url(#${filterId})"` : '';

      // tooltip via <title>
      const stateLabel = STATES[state].label;
      const tooltip = `${day.date} — ${day.total} commit${day.total !== 1 ? 's' : ''} | ${stateLabel}`;

      cells.push(`
    <rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" ry="2"
          fill="${fillColor}" fill-opacity="${op}"${filterAttr}>
      <title>${tooltip}</title>
    </rect>`);
    });
  });

  // – legend –
  const legendItems = [
    { state: 'madrugada', label: 'Night Owl 🌙'   },
    { state: 'manha',     label: 'Early Bird ☕'   },
    { state: 'tarde',     label: 'Peak Hours ☀️'  },
    { state: 'noite',     label: 'Deep Focus 🕯️' },
  ];

  const legendY = TOP_PAD + ROWS * STEP + 16;
  const legendItems_svg = legendItems.map((item, i) => {
    const lx = i * 148;
    return `
    <rect x="${lx}" y="${legendY}" width="${CELL}" height="${CELL}" rx="2" fill="${STATES[item.state].color}"/>
    <text x="${lx + CELL + 5}" y="${legendY + 9}" fill="#8b949e" font-size="10" font-family="monospace">${item.label}</text>`;
  }).join('');

  // – pulse animation on intense cells –
  const pulseAnim = `
  <style>
    @keyframes pulse { 0%,100%{opacity:.85} 50%{opacity:1} }
    .glow-cell { animation: pulse 2.5s ease-in-out infinite; }
  </style>`;

  return `<svg xmlns="http://www.w3.org/2000/svg"
     width="${WIDTH}" height="${HEIGHT}"
     viewBox="0 0 ${WIDTH} ${HEIGHT}"
     role="img"
     aria-label="Energy Rhythm Contribution Graph for ${USERNAME}">
  <defs>
    ${animDefs.join('')}
  </defs>
  ${pulseAnim}

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" rx="8" fill="#0d1117"/>

  <!-- Month labels -->
  ${monthLabels.map(m => `<text x="${m.x}" y="14" fill="#8b949e" font-size="10" font-family="monospace">${m.label}</text>`).join('\n  ')}

  <!-- Cells -->
  ${cells.join('')}

  <!-- Legend -->
  ${legendItems_svg}
</svg>`;
}

// ── Main ───────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`Fetching commits for @${USERNAME}...`);
  const commitDates = await fetchCommits(USERNAME, TOKEN);
  console.log(`  → ${commitDates.length} commits found`);

  const days = buildDayMap(commitDates);
  const svg  = buildSvg(days);

  const outDir = path.resolve(__dirname, '..', 'dist');
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'energy-rhythm.svg');
  fs.writeFileSync(outPath, svg, 'utf8');
  console.log(`  → SVG written to ${outPath}`);
})().catch(err => { console.error(err); process.exit(1); });
