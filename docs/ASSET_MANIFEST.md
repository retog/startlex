# Sound asset manifest

Policy: only sounds that can legally ship with the project. The MVP ships
**no recordings at all** — every stimulus is synthesized on-device at load
time from the parameters below (`src/audio/stimuli.ts`, rendered by
`src/audio/synth.ts`). This also makes them clearly *training sounds*, not
realistic recordings. No gunshot-like recordings are shipped by design.

| ID | Category | Description | Source | License | Duration | Normalization |
| --- | --- | --- | --- | --- | --- | --- |
| `pop-soft` | balloon-pop | Soft muffled pop, gentle 8 ms attack | synthesized in-app, seed 101 (650 Hz band-passed noise burst + 120 Hz body) | MIT (project code) | 0.28 s | peak-normalized to 1.0 |
| `pop-classic` | balloon-pop | Classic sharp balloon pop | synthesized in-app, seed 202 (1600 Hz noise burst + 180 Hz body) | MIT (project code) | 0.22 s | peak-normalized to 1.0 |
| `pop-deep` | balloon-pop | Deeper, rounder pop | synthesized in-app, seed 303 (380 Hz noise burst + 85 Hz body) | MIT (project code) | 0.35 s | peak-normalized to 1.0 |
| `door-soft` | door-closing | Gentle door close + soft latch click | synthesized in-app, seed 404 (280 Hz burst + 110 Hz body, +70 ms transient) | MIT (project code) | 0.49 s | peak-normalized to 1.0 |
| `door-firm` | door-closing | Firm door close | synthesized in-app, seed 505 (500 Hz burst + 90 Hz body, +50 ms transient) | MIT (project code) | 0.50 s | peak-normalized to 1.0 |
| `drop-wood` | dropped-light-object | Light wooden object with one bounce | synthesized in-app, seed 606 (700 Hz burst + 160 Hz body, +180 ms bounce) | MIT (project code) | 0.48 s | peak-normalized to 1.0 |
| `drop-metal` | dropped-light-object | Small metal object, ringing bounce | synthesized in-app, seed 707 (2.4 kHz resonant burst, +150 ms bounce) | MIT (project code) | 0.50 s | peak-normalized to 1.0 |
| `firework-far` | distant-firework | Muffled distant boom, long tail | synthesized in-app, seed 808 (180 Hz burst + 65 Hz body, 15 ms attack) | MIT (project code) | 0.90 s | peak-normalized to 1.0 |
| `firework-burst` | distant-firework | Distant burst with a faint echo | synthesized in-app, seed 909 (420 Hz burst + 80 Hz body, +250 ms echo) | MIT (project code) | 0.95 s | peak-normalized to 1.0 |

Playback amplitude is applied afterwards via the intensity → amplitude
mapping documented in [DATA_MODEL.md](../DATA_MODEL.md); buffers themselves
are stored at peak 1.0 with a 5 ms tail fade.

Future recorded or imported assets must be added to this table with their
exact source and license before shipping. Imported user sounds stay on the
device and are never bundled or transmitted.
