# 🔄 FNF Full-Mod Converter — Psych Engine ⇄ V-Slice

Free in-browser **full mod** converter for Friday Night Funkin' between
**Psych Engine** and **V-Slice / vanilla 0.3+**. No uploads, no signup, no build —
open the [GitHub Pages site](https://venulousthyduckulous.github.io/vslice-psych-converter/)
(or `index.html` locally) and drop a mod `.zip` or loose files.

## What converts

| Psych Engine | V-Slice | How |
|---|---|---|
| `data/<song>/<Song>[-diff].json` + `events.json` | `data/songs/<id>/<id>-chart.json` + `-metadata.json` | Lossless: BPM map, scroll speed, holds (±½ step, moonchart-style), `Alt Animation` ⇄ `mom`, camera events rebuilt from `mustHitSection` |
| `characters/*.json` | `data/characters/*.json` | Anims (prefix/fps/indices/offsets), scale, flip, sing duration, camera/position offsets, health icon |
| `stages/*.json` | `data/stages/*.json` | Zoom, char slots + camera offsets, objects → props (parallax, anims, color) |
| `weeks/*.json` | `data/levels/*.json` | Song list, title, background |
| `data/<song>/dialogue.json` | `data/dialogue/conversations‖speakers‖boxes/*.json` | Lines mapped; speakers auto-generated from your portrait files |
| `songs/<s>/Inst.ogg`, `Voices[-X].ogg` | `songs/<id>/Inst.ogg`, `Voices-<vocalist>.ogg` | Renamed by singer (`Player`→bf…) |
| `images/**` (+`.xml`), icons | `images/**` | Copied; health icons renamed both ways (`icon-x` ⇄ `x`) |
| `*.lua` | `*.hxs` stubs | Logic **cannot** auto-convert — stub with TODO + full original embedded as comments |
| `pack.json` | `_polymod_meta.json` | Title/description mapped |

Every run produces a per-file report (`converted · passthrough · stub · consumed · skipped · error`)
plus a `CONVERSION-REPORT.txt` inside the output zip. Start manual work with `stub`/`error` rows.

## Lane mapping (verified)

Checked against [moonchart](https://github.com/MaybeMaru/moonchart) source and official
`tutorial`/`bopeebo` charts (round-trip is note-identical):

| Format | 0–3 | 4–7 |
|---|---|---|
| V-Slice `d` | player (BF) | opponent |
| Psych `psych_v1` | player | opponent (same numbers) |
| Psych legacy, `mustHitSection=true` | player (same numbers) | opponent |
| Psych legacy, `mustHitSection=false` | opponent (stored +4) | player |

## Develop / test

Static site, plain `<script>`s (works from `file://`). No dependencies except JSZip CDN.

```sh
node /tmp/fnf-fullmod-test.cjs   # full suite (needs the js/ folder; see test file header)
```

## Honest limits

Characters/stages/weeks/dialogue convert best-effort (both engines have fields with no
equivalent — all listed in the report). Lua ⇄ HScript, shaders, per-song scripts and
Animate-atlas art need manual porting. Always playtest in-engine.
