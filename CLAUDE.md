# Rhythm Game — Fall Festival

A rhythm-memory game for a school fall festival booth. The player hears a rhythm, then taps SPACEBAR (or the big on-screen button) to copy it.

GitHub: https://github.com/jadenk349-bit/rhythm-game (branch `main`)

## Files
- `index.html` — the whole game: HTML, CSS and JavaScript in one file. No build step and no dependencies; open it in a browser to play.
- Google Fonts (Fredoka One, Nunito) load from the internet. Without a connection the game still works, just with fallback fonts.

## Game rules (current)
- The player **must type a name** before the game starts. An empty or spaces-only name is rejected with a message and a shake. Pressing Enter in the name box starts the game.
- **3 rounds** with **4, 5, then 6 beats** (`BEATS_PER_ROUND` in the script).
- Every round gets a **new random rhythm** from `generatePattern()`. Gaps between beats are picked from `INTERVAL_CHOICES` (250/375/500/750 ms). Patterns where every gap is the same, or that repeat the previous pattern, are rejected.
- There is only one mode, with one attempt per round. Practice mode and retrying rounds were removed.
- Each round scores out of 100: beat count 33, timing 33, rhythm 34. The game total is out of 300.
- The **name is cleared after every game**: when the final score is shown and when the player exits. "Next Player" returns to an empty name box.
- An **✕ Exit** button (top-left) shows on the countdown, game and result screens. It cancels all pending timers and scheduled sounds, discards the game without saving, and goes back to the start screen.
- Leaderboard: top 10 scores stored in the browser's `localStorage` (key `beatback_leaderboard_v1` — old name kept so saved scores survive). The player's latest score is highlighted by entry id.

## Code notes
- Game-flow timeouts must go through `later(fn, ms)`, not `setTimeout`, so `exitGame()` can cancel them with `clearGameTimers()`.
- `playBeep()` records every oscillator in `activeOscs` so `stopAllSounds()` can silence beats already scheduled with Web Audio.
- `beatX()` is the one place that converts beat time to a pixel position on the visualiser tracks. The target dots, player dots and cursor all use it.
- Tap timing uses `performance.now()`. Player taps are measured relative to the player's first tap, so starting late isn't penalised; only the spacing between taps counts.
- The SPACEBAR handler ignores key presses inside the name input so names can contain spaces.

## Testing
- No automated tests. Open `index.html` in a browser and play through.
- `localStorage` is blocked when the page is opened from a `data:` URL (as in some preview panes), so the leaderboard won't save there. It does save when the file is opened normally.
