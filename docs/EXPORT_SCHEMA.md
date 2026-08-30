# Export schema

Both exports are produced locally (Settings → Your data) and never leave the
device. All timestamps are ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`).
Current `schemaVersion`: **1**.

## JSON export (complete structure)

File: `startle-trainer-export-<timestamp>.json`

```jsonc
{
  "schemaVersion": 1,
  "exportedAt": "2026-08-30T12:00:00.000Z",
  "application": "startle-trainer",
  "sessions": [ /* Session objects, ms-epoch timestamps as stored */ ],
  "trials":   [ /* Trial objects, complete, including null ratings */ ],
  "settings": { /* UserSettings incl. progression state */ }
}
```

`sessions`, `trials` and `settings` are verbatim copies of the stored
entities — see [DATA_MODEL.md](../DATA_MODEL.md) for every field. Note that
inside `sessions`/`trials` the timestamps are the stored millisecond values
(lossless); only `exportedAt` is ISO — CSV is the analysis-friendly format.

## CSV export (trial-level)

File: `startle-trainer-trials-<timestamp>.csv` — RFC 4180, CRLF line ends,
`"`-escaped, header row, one row per trial, session fields denormalized in.

| Column | Type | Description |
| --- | --- | --- |
| `trial_id` | string | trial identifier |
| `session_id` | string | owning session |
| `session_started_at` | ISO 8601 | session start |
| `trial_timestamp` | ISO 8601 | trial armed time |
| `mode` | string | `balloon` or `experiment` |
| `stimulus_id` | string | e.g. `pop-classic` |
| `stimulus_category` | string | e.g. `balloon-pop` |
| `intensity_level` | 1–5 | relative app intensity |
| `amplitude` | 0..1 | applied application amplitude |
| `predictability` | string | predictability mode id |
| `intended_delay_sec` | number | engine-chosen delay |
| `intended_audio_time` | number | audio-clock target (s) |
| `scheduled_audio_time` | number | audio-clock scheduled (s) |
| `user_initiated` | boolean | |
| `visual_context` | string | |
| `experiment_condition` | A–D or empty | 2×2 condition |
| `anticipatory_anxiety` | 0–10 or empty | from session check-in |
| `startle_rating` | 0–10 or empty | empty = not sampled |
| `distress_rating` | 0–10 or empty | separate from startle |
| `recovery_bucket` | string or empty | `under-5s` … `over-60s` |
| `outcome` | string | `completed` / `aborted` / `no-sound` |
| `paused_during` | boolean | |

Empty fields mean "not collected" (null), never zero.
