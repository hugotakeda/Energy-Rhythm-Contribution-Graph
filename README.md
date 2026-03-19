<div align="center">

# 🌙 Energy Rhythm Graph

**A GitHub contribution graph reimagined by circadian rhythm.**  
Automatically generates a color-coded SVG of your commits, colored by the time of day you code.

[![License: MIT](https://img.shields.io/badge/License-MIT-blueviolet?style=flat-square)](./LICENSE)

| State | Hours | Color |
|---|---|---|
| 🌙 Night Owl | 00h – 05h | Neon Purple |
| ☕ Early Bird | 06h – 11h | Soft Gold |
| ☀️ Peak Hours | 12h – 17h | Vibrant Orange |
| 🕯️ Deep Focus | 18h – 23h | Cyan Blue |

</div>

---

## 🚀 Setup (5 minutes)

### Step 1 — Fork or create this repository

Repository already created at [hugotakeda/Energy-Rhythm-Contribution-Graph](https://github.com/hugotakeda/Energy-Rhythm-Contribution-Graph).

### Step 2 — Create a Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new token (classic)**
2. Give it a name like `energy-rhythm-graph`
3. Select scopes: ✅ `repo` and ✅ `read:user`
4. Click **Generate token** and copy it

### Step 3 — Add the token as a Repository Secret

1. In your `energy-rhythm-svg` repo → **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `GRAPH_TOKEN`
4. Value: paste your token
5. Click **Add secret**

### Step 4 — Run the Action manually (first time)

1. Go to **Actions** tab in your repo
2. Click **Generate Energy Rhythm SVG**
3. Click **Run workflow**
4. Wait ~30 seconds — the `dist/energy-rhythm.svg` file will appear in your repo

After the first run, the Action runs **automatically every day at 03:00 UTC**.

### Step 5 — Add to your profile README

In your profile repository (`YOUR_USERNAME/YOUR_USERNAME`), add:

```markdown
<picture>
  <img
    alt="Energy Rhythm Graph"
    src="https://raw.githubusercontent.com/hugotakeda/Energy-Rhythm-Contribution-Graph/main/dist/energy-rhythm.svg"
  />
</picture>
```

---

## 🗂️ How it works

```
scripts/
└── generateSvg.js         # Fetches GitHub commits → generates SVG
.github/
└── workflows/
    └── generate.yml       # Runs daily on cron, commits the SVG
dist/
└── energy-rhythm.svg      # ← auto-generated, embed this in your profile
```

1. The GitHub Action runs `node scripts/generateSvg.js`
2. The script calls the **GitHub GraphQL API** to get all your commits from the last 365 days
3. Each day is classified by the **predominant Energy State** (time of day)
4. A styled SVG is written to `dist/energy-rhythm.svg`
5. The Action auto-commits and pushes the file

---

## 📄 License

[MIT](./LICENSE) © 2026 hugotakeda
