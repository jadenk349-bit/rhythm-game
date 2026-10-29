# Rhythm Game — Fall Festival

A rhythm-memory game for a school fall festival booth. The player hears a rhythm, then taps SPACEBAR (or the big on-screen button) to copy it.

GitHub: https://github.com/jadenk349-bit/rhythm-game (branch `main`)

Live site: https://rhythmgame-vfn6.onrender.com/ — a Render **Static Site** (no server code runs there).

## Files
- `index.html` — the whole game: HTML, CSS and JavaScript in one file.
- `build-config.js` — runs as the Render build command and writes `config.js` from the `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` env vars. It fails the build (so the previous deploy stays live) if either is missing, or if a secret / `service_role` key is supplied by mistake.
- `config.js` — generated, git-ignored. Sets `window.SUPABASE_CONFIG = { url, key }`.
- Google Fonts (Fredoka One, Nunito) load from the internet. Without a connection the game still works, just with fallback fonts.

## Render settings (Static Site)
- Build Command: `node build-config.js`
- Publish Directory: `.`
- Env vars: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Static-site env vars are only read at build time, so after changing them use **Manual Deploy → Clear build cache & deploy**.

## Supabase
- Table `public.rhythm_scores`: `id` (bigint identity PK), `player_name` (text), `score` (integer), `created_at` (timestamptz).
- RLS allows anonymous SELECT and INSERT only, so the browser can't update or delete scores.
- To reset the shared leaderboard, an admin runs this in the Supabase SQL editor: `delete from public.rhythm_scores;`

## Game rules (current)
- The player **must type a name** before the game starts. An empty or spaces-only name is rejected with a message and a shake. Pressing Enter in the name box starts the game.
- **3 rounds** with **4, 5, then 6 beats** (`BEATS_PER_ROUND` in the script).
- Every round gets a **new random rhythm** from `generatePattern()`. Gaps between beats are picked from `INTERVAL_CHOICES` (250/375/500/750 ms). Patterns where every gap is the same, or that repeat the previous pattern, are rejected.
- There is only one mode, with one attempt per round. Practice mode and retrying rounds were removed.
- Each round scores out of 100: beat count 33, timing 33, rhythm 34. The game total is out of 300.
- The **name is cleared after every game**: when the final score is shown and when the player exits. "Next Player" returns to an empty name box.
- An **✕ Exit** button (top-left) shows on the countdown, game and result screens. It cancels all pending timers and scheduled sounds, discards the game without saving, and goes back to the start screen.
- A ⚙️ Settings button (top right, always visible) opens a menu with the Sound on/off toggle, plus Reset Leaderboard in local mode only.
- The leaderboard (top 10) is shown on the home screen. The player's latest score is highlighted by entry id.

## Leaderboard: shared vs local mode
- **Shared mode** (`SHARED_MODE`, true when `config.js` provides Supabase settings): the browser calls the Supabase REST API (`supabaseRequest()`) with only the publishable key in the `apikey` header. The list is fetched with `order=score.desc,created_at.asc&limit=10` every 3 s (`LB_REFRESH_MS`) while the tab is visible, and immediately when it becomes visible again. Reset Leaderboard is hidden (`#reset-item`).
- **Saving a score (shared mode):** `showFinalScreen()` submits once per game. `state.gameId` is set in `startGame()`, and `state.lastGameId` blocks a second submit if the button is clicked twice. The score is first added to a pending queue in `localStorage` (`rhythm_pending_scores_v1`), then uploaded by `flushPending()`. It's removed from the queue only after Supabase confirms the insert, and failed uploads are retried on every refresh tick, including after a page reload or restart. `#lb-status` shows "N score(s) waiting to upload" while anything is queued.
- Known edge case: if an insert reaches Supabase but the reply is lost, the retry inserts it a second time. Fixing that would need a unique client id column on the table.
- **Local mode** (no `config.js`: index.html opened as a file, or in the Claude app preview pane): scores stay on this computer, in memory (`leaderboardCache`) and in `localStorage` (key `beatback_leaderboard_v1`). Reset works there with no passcode.
- Go through `refreshLeaderboard()` / `saveScore()`; never call `localStorage` or `fetch` directly from game code.
- Anyone with the publishable key can insert any score. Optional hardening is a Postgres CHECK constraint on `score` (0–300) and on `player_name` length (1–20).

## Code notes
- Game-flow timeouts must go through `later(fn, ms)`, not `setTimeout`, so `exitGame()` can cancel them with `clearGameTimers()`.
- `playBeep()` records every oscillator in `activeOscs` so `stopAllSounds()` can silence beats already scheduled with Web Audio.
- `beatX()` is the one place that converts beat time to a pixel position on the visualiser tracks. The target dots, player dots and cursor all use it.
- Tap timing uses `performance.now()`. Player taps are measured relative to the player's first tap, so starting late isn't penalised; only the spacing between taps counts.
- The SPACEBAR handler ignores key presses inside inputs so names can contain spaces.

## Running and testing
- No automated tests. Node is installed at `~/.local/node/bin` (not on the default PATH).
- To test shared mode locally without real keys, run a fake Supabase REST server that serves the game plus `config.js`. Use two origins (`localhost` and `127.0.0.1`) so the two "computers" don't share `localStorage`.
- Pushing to `main` redeploys on Render automatically.
