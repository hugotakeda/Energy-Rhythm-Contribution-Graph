// @ts-check
'use strict';

const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const USERNAME = process.env.GITHUB_USERNAME || process.argv[2];
const TOKEN    = process.env.GH_TOKEN        || process.argv[3];
const TIMEZONE = process.env.TIMEZONE        || 'UTC';

if (!USERNAME) {
  console.error('Error: GITHUB_USERNAME is not set.');
  process.exit(1);
}
if (!TOKEN) {
  console.error('Error: GH_TOKEN is not set. Please check your GitHub Secrets (GRAPH_TOKEN).');
  process.exit(1);
}

console.log(`Starting SVG generation for user: ${USERNAME}`);
console.log(`Token provided: ${TOKEN ? 'Yes' : 'No'} (length: ${TOKEN?.length || 0})`);

// ── Energy State ──────────────────────────────────────────────────────────────
const STATES = {
  none:       { label: 'No commits',         color: '#161b22', glow: 'none' },
  madrugada:  { label: 'Shadow Mode',   color: '#6e40c9', glow: '#6e40c9' }, // 00-05
  manha:      { label: 'Logic Prime',   color: '#f2cc60', glow: '#f2cc60' }, // 06-11
  tarde:      { label: 'Peak Velocity', color: '#ff7b72', glow: '#ff7b72' }, // 12-17
  noite:      { label: 'Flow State',    color: '#3fb950', glow: '#3fb950' }, // 18-23
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
  const map = new Map();
  for (let i = 364; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    map.set(key, { date: key, total: 0, details: { madrugada: 0, manha: 0, tarde: 0, noite: 0 } });
  }

  for (const iso of commitDates) {
    const d = new Date(iso);
    
    // Extract local date and hour based on TIMEZONE
    const dtfDate = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIMEZONE });
    const dtfHour = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: TIMEZONE });
    
    const key   = dtfDate.format(d);
    const hour  = parseInt(dtfHour.format(d));
    const state = getEnergyState(hour);

    if (map.has(key)) {
      map.get(key).total++;
      map.get(key).details[state]++;
    }
  }

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
const COLS     = 53;
const ROWS     = 7;
const SIDE_PAD = 20;   // tight horizontal padding
const BOT_PAD  = 55;   // more space for the legend labels

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Build SVG ──────────────────────────────────────────────────────────────────
function buildSvg(days) {
  const firstDate   = new Date(days[0].date);
  const firstDow    = firstDate.getDay();
  const paddedDays  = [...Array(firstDow).fill(null), ...days];

  const weeks = [];
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7));
  }

  const graphWidth = weeks.length * STEP;
  const WIDTH      = graphWidth + 2 * SIDE_PAD;  // dynamic: fits content exactly
  const HEIGHT     = TOP_PAD + ROWS * STEP + BOT_PAD;
  const LEFT_PAD   = SIDE_PAD;

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
      const x       = LEFT_PAD + wi * STEP;
      const y       = TOP_PAD + di * STEP;
      const state   = day.state;
      const cfg     = STATES[state];
      const op      = getOpacity(day.total);
      const hasGlow = day.total > 5 && state !== 'none';
      const filterId = `glow-${wi}-${di}`;

      if (hasGlow) {
        animDefs.push(`
  <filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="2.5" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`);
      }

      const fillColor  = cfg.color;
      const filterAttr = hasGlow ? ` filter="url(#${filterId})"` : '';
      const stateLabel = STATES[state].label.replace(/[^\w\s]/g, '').trim();
      const tooltip    = `${day.date} — ${day.total} commit${day.total !== 1 ? 's' : ''} | ${stateLabel}`;

      cells.push(`
    <rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" ry="2"
          fill="${fillColor}" fill-opacity="${op}"${filterAttr}>
      <title>${tooltip}</title>
    </rect>`);
    });
  });

  // – legend –
  const legendItems = [
    { state: 'madrugada', label: 'Shadow Mode',   hours: '00h – 05h' },
    { state: 'manha',     label: 'Logic Prime',   hours: '06h – 11h' },
    { state: 'tarde',     label: 'Peak Velocity', hours: '12h – 17h' },
    { state: 'noite',     label: 'Flow State',    hours: '18h – 23h' },
  ];

  const legendY          = TOP_PAD + ROWS * STEP + 10;
  const itemWidth        = 140;
  const totalLegendWidth = legendItems.length * itemWidth;
  const legendStartX     = Math.floor((WIDTH - totalLegendWidth) / 2);

  const legendItems_svg = legendItems.map((item, i) => {
    const lx = legendStartX + i * itemWidth;
    return `
    <rect x="${lx}" y="${legendY}" width="${CELL}" height="${CELL}" rx="2" fill="${STATES[item.state].color}"/>
    <text x="${lx + CELL + 6}" y="${legendY + 9}"  fill="#8b949e" font-size="10" font-family="monospace">${item.label}</text>
    <text x="${lx + CELL + 6}" y="${legendY + 20}" fill="#555e6b" font-size="9"  font-family="monospace">${item.hours}</text>`;
  }).join('');

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
