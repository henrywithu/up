# Don't Look Up: source and behavior inventory

Reference: <https://www.dontlookup.app/>. Local project: **Up**. This document separates recovered reference facts from the current implementation. The reference was inspected in Chrome at 1588 × 838 on 25 September 2026, including the title, five tutorial cards, paused help, active game, distraction selection, placement, and a toppling sequence. Its public HTML and JavaScript were saved in `reference/` as evidence only. No production script runs in the local application.

## Production resources

The page loads one module, `/assets/index-urJsVLlw.js` (880,816 bytes), with roughly 153 KB of inline CSS and semantic DOM already in the HTML. It uses Three.js, GLTFLoader, GSAP, HTML overlays, Canvas 2D for procedural textures/faces, and Web Audio. No site authored GLSL files were found. The rendered scene uses `MeshToonMaterial`, a 3-pixel gradient texture `[214,244,255]`, texture luminance remapping, and normal-expanded back-face outline geometry. The local renderer keeps these as individual source modules.

The following 59 original files returned valid media and are in `public/assets/`. `docs/ASSET_MANIFEST.json` records each original URL, byte count, and SHA-256 hash:

| Group | Count | Original assets |
| --- | ---: | --- |
| 3D | 4 | `giant.glb`, `prop_ball.glb`, `prop_cat.glb`, `prop_tv.glb` |
| Fonts | 5 | `Marsipan-Regular.woff2`, `luckiest-guy-latin.woff2`, `luckiest-guy-latin-ext.woff2`, `nunito-latin.woff2`, `nunito-latin-ext.woff2` |
| Audio | 17 | Ambient, each distraction, panic, lose, win, countdown/celebration cues; see `public/assets/audio/` |
| Raster/vector artwork | 33 | Wordmark, coin art, icons, 8 cards, 8 tutorial figures, ending art, open graph image |

The JavaScript mentions `/assets/character.glb`, `/assets/anim_walk_arm.glb`, and `/assets/anim_run_arm.glb`, but all three public requests returned `NOT_FOUND` rather than glTF data. These are not served locally. The visible citizens are procedural meshes in the recovered code: a lathed body, sphere head, cylinder/sphere limbs, Canvas faces, hats, and shirts. The original giant and three GLB props are usable. Several other props are procedurally constructed rather than model downloads.

## Visual system and layout

- `--paper: #f4f3ef`, `--ink: #14140f`, `--red: #c0342a`; yellow stages `#f8e08a`, `#f2c31a`, `#c98f06`; believer blue `#9abeef`; divided red badge `#eda6a0`.
- Marsipan is the title/display face, Nunito the body UI. Font files are self-hosted with `font-display: block`. The wordmark is a source PNG.
- The scene fills the viewport with no page scrolling. On desktop, the ledger occupies the upper left; fee panel is fixed upper right, 268 px wide and 16 px from the edges; help and feet meter sit bottom left; inspection lens and the distraction rail sit bottom right; the credit is centered at the bottom.
- Desktop rail buttons are 44 × 44 px, 3 px ink stroke, irregular radii, 4 × 5 px black sticker shadow, numbered badge, and price beneath. The selected card is 372 px wide with a 96 px image and is positioned above the active rail button by JavaScript.
- Title and tutorial overlay the *live moving scene*. The tutorial card is 460 px wide at the observed desktop viewport. Tutorial controls overlap the lower edge of its image. The first step demonstrates the actual fee bar. The fourth replaces art with yellow, blue, and red figure explanations.
- At ≤820 px or coarse pointer, controls and text resize. Portrait places the distraction rail vertically at the right, with a CSS calculated height from the number of currently unlocked buttons. The footer credit hides when the consent card would overlap it below 1060 px. Landscape ≤520 px high has additional compact rules. Motion reduction disables selected CSS animation.
- The exact production stylesheet was extracted to `src/styles/reference.css`; `src/styles/local.css` contains only local integration rules.

## Routes, screens, and copy

The game is a single route `/`. The title says: “You are very rich, very tall, and standing on quite a lot of people.” First Start opens the tutorial if the `dlu.seen` flag has not been saved; later Start goes directly to play. Tutorial opens from the title or the pause/help control and can be skipped. It pauses the game clock when opened during a run.

| Step | Title | Main point |
| ---: | --- | --- |
| 1 | They pay for all of this | Fee revenue, crowd tolerance line, looking up stops payment |
| 2 | Distract them | Fast props turn yellow heads down but wear off |
| 3 | Some keep working for you | Influencers make believers or divide the crowd |
| 4 | Read the crowd by its colour | Yellow notices, blue believes, red argues |
| 5 | Never let them look up together | Reach $1 trillion before enough yellow people reach the giant |

The exact five title/body strings and art paths are in `src/data/tutorial.ts`. Other reference states include intro loader, consent card, active HUD, selection preview, placement cursor/ring, fee lesson bubble, distraction lesson bubble, pause/help, win with shareable souvenir, toppled loss, and one-hour timeout. The production HTML includes descriptive comments for the purpose and positioning of these surfaces.

## Scene, camera, animation, and interaction

- World radius 27, crowd initially 48 on desktop and 26 on coarse/mobile, potentially growing to 300. Initial two have noticed. Citizen height is about 1.7 world units. Walking speed range is 1.05–1.65 units/s, with conversational grouping and loitering.
- Perspective camera: 34° field of view, design aspect 1.4, base position `[0,43,54]`, target `[0,2,-3]`; field of view can expand to 58° on narrow screens. Intro camera continuously orbits at 0.08 rad/s, moving between distance 64/height 35 and distance 13/height 4.4 on a 16 second cosine cycle. Play handover is 1.5 seconds.
- Giant model is scaled to 48 units high, placed around `[0,0,-26]`, yaw 0.14 rad. Source rig subdivides pelvis/hips/knees/ankles; its idle sway is 0.009 at speed 0.21, with weight shift 0.55 and periodic steps every 6–13 seconds. Topple duration is 1.5 seconds, followed by smoke and crowd celebration.
- A successful run disables orbit controls and uses the recovered `win.move = 2.9s`, `win.hold = 5.4s`, distance 62, height 6.5, and target lead before showing the ending card. The local camera keeps this handoff and timing while the production’s rigged giant and coin drain remain simplified.
- Puppets have source dimensions: torso lathe reaches y=1.32; head sphere radius 0.235; leg radius 0.085/length 0.34; arm radius 0.07/length 0.3; outline thickness 0.05. Base characters are white with hats or dark shirts, then tint yellow, blue, or red as their state changes. The reference uses pooled instanced meshes and face canvases.
- Cursor projects the pointer onto the ground plane. An armed distraction shows a dashed circular footprint with 34 segments and 55% dash fill; touch displays “Tap anywhere to place it.” Placement spends money, drops the chosen prop and uses sound, particles, and a local crowd effect. Escape and Inspect clear selection.
- Keyboard: `Space` opens the menu, `1`–`8` choose the visible items, `Escape` cancels, `↑`/`↓` change fee. The on-screen hint still says 1–9, but the recovered current configuration contains eight props. Desktop rail and portrait phone column expose available props without opening the menu.
- Fee starts at 5%, moves in 5 point increments, and starts with a 30% tolerance marker. Raising it increases awareness; taking it above tolerance hastens noticing. The fee panel, meter, warning banners, and bubbles update during play.

## Economy and distraction data

The complete recovered configuration object is in `src/data/config.ts`. Key rules are `target = 1e12`, `timeLimit = 3600`, `perCitizen = 55e6`, payment weights living 1 / talking 0.6 / watching 0.85 / arguing 1 / believing 1.15 / awake 0, and source price formula `costSeconds × population × perCitizen × costScale`. Cost scale rises smoothly from 0.075 to 0.17 over 150 seconds; influencer prices additionally reflect fee and deployed towers. Initial reference pricing at 48 citizens is $356.4M for Big match and $435.6M for Cute cat.

| Key | Label | Unlock stage | Cost seconds | Life | Capacity | Effect |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| ball | Big match | 0 | 1.8 | 10s | 3 | Short watch |
| cat | Cute cat | 0 | 2.2 | 22s | 4 | Short watch |
| tv | TV | 1 | 3 | 14s | 6 | Watch |
| dance | Viral dance | 1 | 5 | 30s | 12 | Dance |
| news | Post a fake news | 2 | 9 | 72s | 16 | Blame/division |
| coach | Finance guru | 3 | 26 | 110s | 4 | Influence/belief |
| priest | Have faith | 3 | 26 | 110s | 3 | Influence/belief |
| trainer | The politician | 3 | 34 | 95s | 6 | Influence/anger |

The source data also includes individual reaction lines, rotating satirical card headlines, pull radius, power, shelter radius, contagion, belief, uprising, coins, particle, and audio parameters. The local implementation reuses source costs, life, capacity, icons, image art, payment weights, and opening talking/living distribution. At 48 citizens, 2 awake, 22 talking, and 24 living produce the observed opening rate of $102.3M/s at 5%. Props now have source-derived timed lifetimes, capacity-limited attraction, state colors, influence conversion pulses, blame division, source tower-price escalation, and original model or procedural fallback placement. Social decision making, pooled instancing, and movement remain modular rather than depending on the production bundle.

## Audio

The source uses an `AudioContext`, decodes 17 AAC files, starts ambient audio after user input, and plays distraction-specific clips. It loops the dance clip, layers priest/church by a one second gap, and pairs the blame intro/crowd clips. Panic music fades in at 1.4s, ducks ambience to 35%, and fades out over 2.6s. The reference also synthesizes UI hovers/clicks, notice chords, countdown tones, approach tones, and separate lose, timeout, win, and celebration clips. Local audio uses the original AACs with the recovered loop and gain envelopes, ambient ducking, panic fade, blame layering, priest gap, UI tones, notice chords, countdown, and target-approach cues. Spatial response and the full cinematic win cue schedule remain simplified.

## Verification and fidelity gaps

- Confirmed: all 59 valid assets are present and hash-verified against `docs/ASSET_MANIFEST.json`; `npm run build` and `git diff --check` pass; title, tutorial step one, game start, opening economy, rail selection, placement, crowd inspection, and a 390 × 844 layout were inspected in a local browser without console errors before the final source refinements.
- Source-derived but currently incomplete: the production’s full social AI and pooled instancing, spatial prop rigs and reaction bubbles, giant skinning details, cinematic victory/photo sharing, and a few landscape-specific transitions. The local scene uses modular equivalents and keeps these boundaries explicit in this document.
- Browser screenshot comparison is time dependent because the reference title camera and crowd animate. No claim of pixel identity or full gameplay parity is made yet. There is no deployment.
