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

Playback amplitude is applied afterwards via the intensity → amplitude
mapping documented in [DATA_MODEL.md](../DATA_MODEL.md); buffers themselves
are stored at peak 1.0 with a 5 ms tail fade.

Future recorded or imported assets must be added to this table with their
exact source and license before shipping. Imported user sounds stay on the
device and are never bundled or transmitted.
