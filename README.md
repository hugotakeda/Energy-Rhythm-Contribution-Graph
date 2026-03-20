<div align="center">

# Energy Rhythm Graph

**A GitHub contribution graph reimagined by circadian rhythm.**  
Automatically generates a color-coded SVG of your commits, colored by the time of day you code.

[![License: MIT](https://img.shields.io/badge/License-MIT-blueviolet?style=flat-square)](./LICENSE)

| State | Hours | Color |
|---|---|---|
| **Shadow Mode** | 00h – 05h | Neon Purple |
| **Logic Prime** | 06h – 11h | Soft Gold |
| **Peak Velocity** | 12h – 17h | Vibrant Orange |
| **Flow State** | 18h – 23h | Cyan Blue |

</div>

---

<div align="center">
   
# Exemple:
Not very colorful, but it's still an example hahahaha.

<p align="center">
  <img src="https://raw.githubusercontent.com/hugotakeda/Energy-Rhythm-Contribution-Graph/main/dist/energy-rhythm.svg?v" />
</p>

</div>

---

## Quick Start (5 minutes)

1.  **Fork** this repository.
2.  Generate a **Personal Access Token (classic)** with `repo` and `read:user` scopes at [github.com/settings/tokens](https://github.com/settings/tokens).
3.  In your fork, go to **Settings → Secrets and variables → Actions** and add a new secret:
    *   **Name:** `GRAPH_TOKEN`
    *   **Value:** (your generated token)
4.  Go to the **Actions** tab, select **Generate Energy Rhythm SVG**, and click **Run workflow**.
5.  Add the generated SVG to your profile README:

```markdown
<p align="center">
  <img src="https://raw.githubusercontent.com/YOUR_USERNAME/Energy-Rhythm-Contribution-Graph/main/dist/energy-rhythm.svg" />
</p>
```
*Replace `YOUR_USERNAME` with your GitHub handle.*

---

## Configuration (Optional)

By default, the graph uses **UTC**. To use your local time:
1.  Go to **Settings → Secrets and variables → Actions**.
2.  Switch to the **Variables** tab (top right).
3.  Click **New repository variable**.
4.  **Name:** `TIMEZONE` | **Value:** `America/Sao_Paulo` (or [your timezone](https://docs.sentinel.thalesgroup.com/softwareandservices/ems/EMSdocs/WSG/Content/TimeZone.htm)).

---

## How it works

The system uses **Node.js** and the **GitHub GraphQL API** to fetch your commit history from the last 365 days. 

-   **Logic:** Each day is colored based on the *predominant* hour of your commits.
-   **Glow:** High-frequency days (9+ commits) get a subtle neon glow effect.
-   **Precision:** The SVG is locked at **775px** width to perfectly align with other standard GitHub metrics cards.

---

## License

[MIT](./LICENSE) © 2026 hugotakeda
