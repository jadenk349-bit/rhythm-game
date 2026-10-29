# Rhythm Game — Fall Festival

A rhythm-memory game for a school fall festival booth. The player hears a rhythm, then taps SPACEBAR (or the big on-screen button) to copy it.

GitHub: https://github.com/jadenk349-bit/rhythm-game (branch `main`)

## Files
- `index.html` — the whole game: HTML, CSS and JavaScript in one file.
- `server.js` — small Node server (no framework). Serves `index.html` and the shared leaderboard API. Uses Postgres when `DATABASE_URL` is set, otherwise keeps scores in memory (local testing only).
- `package.json` — `npm start` runs the server; the only dependency is `pg`.
- `render.yaml` — Render Blueprint: creates the `rhythm-game` web service and the `rhythm-game-db` Postgres database, and links them through `DATABASE_URL`. `ADMIN_PASSCODE` is entered on Render (`sync: false`) and never committed.
- Google Fonts (Fredoka One, Nunito) load from the internet. Without a connection the game still works, just with fallback fonts.

## Game rules (current)
- The player **must type a name** before the game starts. An empty or spaces-only name is rejected with a message and a shake. Pressing Enter in the name box starts the game.
- **3 rounds** with **4, 5, then 6 beats** (`BEATS_PER_ROUND` in the script).
- Every round gets a **new random rhythm** from `generatePattern()`. Gaps between beats are picked from `INTERVAL_CHOICES` (250/375/500/750 ms). Patterns where every gap is the same, or that repeat the previous pattern, are rejected.
- There is only one mode, with one attempt per round. Practice mode and retrying rounds were removed.
- Each round scores out of 100: beat count 33, timing 33, rhythm 34. The game total is out of 300.
- The **name is cleared after every game**: when the final score is shown and when the player exits. "Next Player" returns to an empty name box.
- An **✕ Exit** button (top-left) shows on the countdown, game and result screens. It cancels all pending timers and scheduled sounds, discards the game without saving, and goes back to the start screen.
- A ⚙️ Settings button (top right, always visible) opens a menu with the Sound on/off toggle and Reset Leaderboard.
- The leaderboard (top 10) is shown on the home screen. The player's latest score is highlighted by entry id.

## Leaderboard: shared vs local mode
- **Shared mode** (`SHARED_MODE`, page served over http/https by `server.js`): scores are saved to the server, so every computer sees the same list. The home screen re-fetches every 15 s (`LB_REFRESH_MS`). Reset requires the admin passcode, which the server checks against `ADMIN_PASSCODE`; if that env var isn't set, reset is disabled. If the server can't be reached, a warning shows under the list (`#lb-status`).
- **Local mode** (index.html opened as a file, or in the Claude app preview pane): scores stay on this computer, in memory (`leaderboardCache`) and in `localStorage` (key `beatback_leaderboard_v1`, old name kept so earlier saved scores survive). Reset needs no passcode. The preview pane blocks `localStorage`, so there the list empties on reload.
- Go through `refreshLeaderboard()` / `saveScore()` / `loadLocal()` / `storeLocal()`; never call `localStorage` or `fetch` directly from game code.
- `showFinalScreen()` stores the save promise in `state.pendingSave`; `refreshLeaderboard()` awaits it so the just-finished game always appears.

## API (server.js)
- `GET /api/scores` → `{ scores: [{id, name, score}] }` (top 10, highest first; ties go to the earlier score)
- `POST /api/scores` `{name, score}` → `201 { id, scores }`. The name is trimmed and cut to 20 characters. The score must be a whole number from 0 to 300. Bad input → 400.
- `POST /api/scores/reset` `{passcode}` → `200 { scores: [] }`, or 403 for a wrong or unset passcode.
- `GET /healthz` → `{ ok: true }` (Render health check).
- The server can't verify that a score was really earned; anyone can POST any score from 0 to 300.

## Code notes
- Game-flow timeouts must go through `later(fn, ms)`, not `setTimeout`, so `exitGame()` can cancel them with `clearGameTimers()`.
- `playBeep()` records every oscillator in `activeOscs` so `stopAllSounds()` can silence beats already scheduled with Web Audio.
- `beatX()` is the one place that converts beat time to a pixel position on the visualiser tracks. The target dots, player dots and cursor all use it.
- Tap timing uses `performance.now()`. Player taps are measured relative to the player's first tap, so starting late isn't penalised; only the spacing between taps counts.
- The SPACEBAR handler ignores key presses inside inputs so names and passcodes can contain spaces.

## Running and testing
- No automated tests. Node is installed at `~/.local/node/bin` (not on the default PATH).
- Local server: `.claude/launch.json` has a `rhythm-game` config (port 3123, in-memory scores, test passcode `test1234`), which is git-ignored. Or run `PATH="$HOME/.local/node/bin:$PATH" npm start`.
- Pushing to `main` redeploys on Render automatically.
