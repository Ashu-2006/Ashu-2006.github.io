# Retro build: design brief

A separate site from `hero/`. Nothing in `hero/` is edited. Project copy and media are read from
`hero/src/content` and `hero/public/media` so there is one source of truth for the words and files.

## Concept: the self-titled LP

The portfolio is pressed like a 1970s record.

| Site part | In the world | Interaction |
|---|---|---|
| Hero | The album sleeve (portrait) with the vinyl sliding out | Record spins at 33 1/3, drag it to scratch, sleeve tilts toward the cursor |
| Case studies | Side A tracklist | The same 3D sleeve follows into the list and swaps its art to the hovered track |
| More projects | The crate | Flip through sleeves (wheel, drag, arrows) |
| Playground + game | The den TV | Channel knob: channel 1 is Night Drive (a playable pseudo-3D road game with a 70s car), the rest are playground pieces |
| About | Liner notes and tour dates | Draggable photo prints with fact stickers |
| Contact | Encore | Copy email, live Jabalpur clock |

Rules taken from the Dive Club "playable portfolio" episode: work up front, the move into a project has
to feel good, the playable layer never blocks the work, reduced motion is respected, semantic HTML and
structured data for AI search.

## Tokens

Color (70s harvest kitchen, not cream + terracotta):

| Token | Hex | Role |
|---|---|---|
| chocolate | `#2A1A12` | ink, dark grounds |
| bone | `#F1E2C0` | paper |
| harvest | `#E4A62C` | gold stripe, highlights |
| rust | `#D25F27` | orange stripe |
| poppy | `#BF3426` | red stripe, encore ground |
| avocado | `#6B7431` | den wall |

Type:

- Fraunces (SOFT 100, WONK 1, opsz 144, wght 800-900): display, titles, email. Soft 70s serif.
- Archivo (wdth 62-125): body at wdth 100, poster billing condensed at wdth 62-75.
- Press Start 2P: TV and game only.

Layout: side gutter `max(140px, 9.75vw)` at 1200px and up, 64px tablet, 20px phone. Section padding
`clamp(120px, 16vw, 260px)`. Text left aligned. One memorable thing per section, everything else quiet.

## Stack

Vite + TypeScript (vanilla), GSAP 3 (ScrollTrigger, SplitText, Draggable, Inertia), Lenis, Three.js.
CRT effect is a raw WebGL2 pass. Sound is synthesized with WebAudio (no audio files), off by default.
Routes are client-side (`/retro/`, `/retro/work/:slug/`) and pre-rendered to static HTML at build time.
