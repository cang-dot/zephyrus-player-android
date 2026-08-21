# Zephyrus Player MD3 Component Showcase

## Format

- 1920x1080, 30fps, 900 frames, 30 seconds.
- Frame boundaries are frozen in `src/data.ts` and aligned to the analyzed 120 BPM source window.
- The renderer is a deterministic Vue harness. `window.__ZEPHYRUS_SHOWCASE__.seekToFrame(frame)` is the only clock; no wall-clock animation is used for scene state.

## Visual system

Material You surfaces use the current frozen song's primary color and surface color. Rounded surfaces use 24-38px radii, with restrained shadows and one focal sheen per scene. All readable captions are 28px or larger at 1080p.

## Motion breakdown

1. MD3 orbit: a single song card is the hero; chips orbit and inherit its color.
2. Database pullback: titles spread on a deterministic field and resolve into the AMLL-TTML-DB wordmark.
3. Lyrics: word-level fill and skew are computed from the frame time; background lyric copy stays subordinate.
4. Alignment: left, center, and right states are shown with a single selection surface.
5. Styles: real player-style screenshots are used as preview textures with a restrained camera push.
6. Smart transition: thick track, five snap points, and a thumb that follows the frame-progress before snapping.
7. Playbar: mini bar, cover crossfade, transition status, and progress color remain one shared visual system.
8. Poster: selected lyric lines retain their order while they move into a paper-like poster surface.
9. Brand: the project logo resolves on a quiet final card with the repository URL.

The browser chrome is excluded. Canvas/WebGL loops are not started by this showcase; style previews are frozen source screenshots so rendering remains deterministic and resource bounded.

## Audio

The supplied file `M500001BqM3L4CiWfB.mp3` was analyzed with librosa. The selected crop starts at 38.0110657596s, is 30s long, and is approximately 120 BPM. `scripts/render.mjs` creates a BGM version and a mixed version with short whoosh/impact SFX. The source music license must be confirmed by the distributor before public release.

## Rendering fallback

The installed npm registry does not contain `vueseq@^1.0.2`, so the project uses the VueSeq-compatible `seekToFrame()` harness and Playwright + FFmpeg fallback described in the approved plan. This keeps the scene data and deterministic interface compatible with a later VueSeq install or WebCodecs renderer.
