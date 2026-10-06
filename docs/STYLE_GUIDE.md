# Hangar Style Guide

The design and motion language of `apps/web`, derived from the code. If this guide and the code disagree, the code wins and this guide gets fixed in the same change.

> **The consistency rule.** Before building any new screen, flow, component, or animation, search the codebase for the closest existing instance (similar action, layout, state, or motion) and follow it very closely: same tokens, same components, same timing, same structure, same copy tone. Reuse before creating. Only introduce a new pattern when no existing one fits, and when you do, add it to this guide in the same change. Never hardcode a color, duration, easing, or spacing value that has a token.

Paths below are relative to `apps/web/app/` unless they start with the repo root.

---

## 1. Principles

**Brand.** Hangar is a self-hosted platform that launches apps. The lore is an aircraft carrier: apps are jets, the pipeline is the deck, going live is a launch. It's a night deck: dark, quiet, technical, lit by amber deck lights, with green reserved for "live".

**Two volumes.** The story page (`/`) is the airshow: pinned, scrubbed, cinematic. The dashboard (`/dashboard` and everything under it) is the instrument panel: same palette, type and curves, almost still. Section 11 covers the dashboard; don't carry story choreography into it.

**Velocity.** Motion explains how things move, not just that they changed.

| Idea | What it looks like here | Code |
|---|---|---|
| Acceleration | Things gaining speed start slow, then go: `throttle`. A catapult stroke is constant acceleration: `catapult` | Hero camera push (`story/acts/deck.tsx`); the launch stroke, the crew jet pulling away, the rollback break (`launch.tsx`, `crew.tsx`, `squadron.tsx`) |
| Weight | Heavy things move symmetrically and slowly: `glide` | Bay doors, camera pans |
| Anticipation | A small move against the main one first | Door dips 8px before rising; crew arm drops before it salutes |
| Follow-through | Arrivals overshoot slightly or settle long | Parts lock in with `snap`; text and cards land with `settle`; landings roll to a stop with `coast` |
| Deliberate impact | Shake, flash, speed lines and shockwaves happen at exactly one moment | The launch shot only; a smaller echo when the rollback jet traps |

**We never:**
- use `linear` or the browser's default `ease` for anything that isn't a scroll scrub or a vehicle holding its speed (`EASE.cruise`)
- animate layout properties (width, height, top, left, margins) in motion code
- use impact effects (shake, flash, speed lines) outside the launch and its squadron echo
- replay entrance animations on data refetches
- hide content behind JavaScript: every act and page renders a complete still frame without it
- claim a capability the API doesn't have (see §7)

---

## 2. Motion tokens

### 2.1 Easing — `lib/motion.ts` (`EASE`), CSS twins in `app.css` (`--ease-*`)

| Token | GSAP name | Cubic-bezier | CSS / Tailwind | Use for |
|---|---|---|---|---|
| `EASE.throttle` | `hangar.throttle` | `0.7, 0, 0.84, 0` | `--ease-throttle` / `ease-throttle` | Anything gaining speed: launches, camera pushes, a jet leaving |
| `EASE.settle` | `hangar.settle` | `0.16, 1, 0.3, 1` | `--ease-settle` / `ease-settle` | Arrivals: text, cards, panels, camera settling. **Default** for UI transitions |
| `EASE.glide` | `hangar.glide` | `0.65, 0, 0.35, 1` | `--ease-glide` / `ease-glide` | Heavy symmetric moves: doors, pans, turns |
| `EASE.snap` | `hangar.snap` | `0.34, 1.45, 0.64, 1` | `--ease-snap` / `ease-snap` | Parts locking into place, status dots popping in |
| `EASE.brake` | `hangar.brake` | `0.05, 0.7, 0.1, 1` | `--ease-brake` / `ease-brake` | Hard stops. Not used in the story since the physics pass; prefer `coast`, which hands speed over cleanly |
| `EASE.spool` | `hangar.spool` | `0.5, 0, 0.75, 0` | `--ease-spool` / `ease-spool` | Pressure building before a release: thrust, anticipation dips |
| `EASE.catapult` | `hangar.catapult` | `0.33, 0, 0.67, 0.33` | `--ease-catapult` / `ease-catapult` | Constant acceleration from rest: the catapult stroke. Ends at 2× its average speed |
| `EASE.coast` | `hangar.coast` | `0.33, 0.67, 0.67, 1` | `--ease-coast` / `ease-coast` | Constant deceleration to rest: a jet rolling up to the catapult, a camera easing to a stop. Starts at 2× its average speed |
| `EASE.cruise` | `none` | linear | — | A vehicle holding its speed along a path: the climb-out, the landing pattern |
| `EASE.scrub` | `none` | linear | — | Scroll-scrubbed tracks only. `SCRUB` lag supplies the smoothing |
| `EASE.impact` | `none` | linear | — | Single-frame hits and keyframed shakes, which carry their own shape. Launch only |

Curves are registered once by `registerEases()` (`lib/motion.ts`). There are no springs; overshoot comes from `snap`. `entrySpeed(ease)` and `exitSpeed(ease)` return a curve's speed at its start and end, as a multiple of its average speed; use them to hand speed from one tween to the next (§2.6).

### 2.2 Duration — `DUR` in `lib/motion.ts`, seconds

| Token | Value | Use for |
|---|---|---|
| `DUR.impact` | 0.06 | Single-frame hits: the launch flash and shockwave appearing. Launch only |
| `DUR.instant` | 0.12 | Micro feedback: a hand signal, a tick |
| `DUR.quick` | 0.24 | Small state swaps: a status pill, a HUD line |
| `DUR.base` | 0.48 | Default UI transition |
| `DUR.slow` | 0.8 | Entrances, count-ups, page reveals |
| `DUR.epic` | 1.4 | Hero-scale moves: the hero intro, big text reveals |

CSS uses the same scale as `--dur-*` variables and `duration-*` utilities (`app.css`). Each utility sets both `transition-duration` and `--tw-duration`, so it also times `tw-animate` popups.

| Utility | Variable | Value | Use for |
|---|---|---|---|
| `duration-instant` | `--dur-instant` | 120ms | — |
| `duration-quick` | `--dur-quick` | 240ms | Hover, focus, fields, popups, row tints, chevrons |
| `duration-base` | `--dur-base` | 480ms | Status colours, flight-path nodes, selection bars |
| `duration-slow` | `--dur-slow` | 800ms | The flight-path track and jet, the page glow turning green |
| `duration-epic` | `--dur-epic` | 1400ms | — |

Tailwind's numeric `duration-200` etc. are not used. Hold times that aren't motion (a "copied" tick, a fallback timer) are named constants in the file that uses them (`COPIED_HOLD_MS`, `GUARD_TIMEOUT_MS`).

**Scrubbed timelines are different.** Inside a pinned, scrubbed timeline, `duration` and position are **fractions of the act's scroll length** (0–1), not seconds. `duration: 0.06` means "6% of the pin". Don't use `DUR` there.

### 2.3 Stagger — `STAGGER` in `lib/motion.ts`, seconds

| Token | Value | Use for |
|---|---|---|
| `STAGGER.chars` | 0.018 | Per-character type reveals (the coda headline) |
| `STAGGER.tight` | 0.04 | Lists that should read as one gesture (dashboard rows, steam puffs) |
| `STAGGER.base` | 0.08 | Lines of text, CTA pairs |
| `STAGGER.loose` | 0.14 | Separate objects arriving one by one (blueprint annotations) |
| `STAGGER.wide` | 0.22 | Reserved; not used yet |

### 2.4 Scroll — `story/motion.ts`

| Token | Value | Meaning |
|---|---|---|
| `SCRUB` | 0.8 | Seconds the scrubbed playhead lags the scrollbar (inertia) |
| `PIN.deck` | 110% / 90% | Pinned length, desktop / mobile, as % of viewport height |
| `PIN.hangar` | 260% / 220% | |
| `PIN.crew` | 320% / 300% | |
| `PIN.launch` | 240% / 200% | |
| `PIN.squadron` | 320% / 260% | Long enough to watch the rollback fly its circuit |
| `PIN.fleet` | 140% / 120% | |

Use `pinLength(act, isDesktop)` rather than writing `+=N%`.

### 2.5 Pacing rules

- **Fast vs slow.** Feedback to a user action is `instant`–`quick`. Content arriving is `slow`. Only the hero intro and story-scale moves get `epic`.
- **Overlap.** Sequences overlap, they don't queue: start the next beat before the last one finishes (the hero starts the headline while the door is still rising; the launch flash fires as the jet clears the bow).
- **Maximum simultaneous.** Outside the story, at most **one entrance sequence** per view (`useReveal`) plus state transitions. In a story act, one primary subject plus parallax layers; impact effects only at the launch.
- **Once.** Entrance sequences run once per mount (`useReveal` guards this). Polling must never replay them.

### 2.6 Vehicle physics

Jets, ships and anything else that flies or drives obey these rules. Hangar parts snapping together are assembly, not flight, and are exempt.

- **Nose first.** A vehicle only moves the way it points. Heading follows the path tangent: `motionPath: { path, autoRotate: true }`, or `autoRotate: 90` for top-down art drawn nose-up (`JetPlan`). No sideways or backwards slides, no spins in place.
- **Turns are arcs.** Turn on an arc with a radius at least the vehicle's length. To reverse direction, fly a pattern (`squadron.tsx`: break, a corridor down the empty side, final approach), never a pivot. Keep the whole pattern inside the frame at 390px; move furniture out of its way rather than flying off-screen.
- **Speed is continuous.** A moving thing never starts or stops instantly unless something stops it (the arrestor wire). When tweens chain on one subject, the speed must match at the seam: `exitSpeed(a) × distanceA / durationA = entrySpeed(b) × distanceB / durationB`. Measure path length with `MotionPathPlugin.getLength(path)`. Don't follow `throttle` with `settle` on the same axis.
- **Hand-offs between acts.** A vehicle that leaves one act and enters the next keeps its speed across the cut. `TAXI_HANDOFF` (`story/motion.ts`, stage units per viewport of scroll) is that speed; `taxiHandoff(act, isDesktop)` converts it to act progress. Size the run to the visible stage edge with `visibleSpan(stage)` so the speed is reached exactly where the vehicle crosses the frame. Act III's camera eases to a stop (`coast`) while the jet gains speed (`catapult`), so it leaves at its true speed and enters Act IV's fixed camera at the same speed.
- **Climbs are gradual.** Pitch rises along a curve, never in a separate rotation tween: 10–25° for a jet near the deck. The launch climbs to 25° on a 900-unit arc that starts at the bow.
- **Ground stays ground.** Wheels sit on the deck until lift-off. Rotate jets about the main gear (`svgOrigin` at the contact point) so the tail clears the deck as the nose rises.
- **Static poses.** Put a jet's no-JS / reduced-motion pose on a wrapper (`data-jet-pose`, `data-back-pose`) that motion clears with `attr: { transform: '' }`. Don't mix a static `transform` attribute with GSAP transforms on the same element.

---

## 3. Choreography patterns

| Pattern | Recipe | Reference | Reuse / off limits |
|---|---|---|---|
| **Pinned scrubbed act** | `useAct(ref, setup)`, then `const tl = actTimeline(ref.current, act, isDesktop)`: pinned for `pinLength(act)`, scrubbed with `SCRUB` lag, and reversible, so scrolling back up rewinds the act. Positions are 0–1 beats. Markup is the composed final frame; animate with `from`/`fromTo` | `story/acts/hangar.tsx` (`BEAT` map) | Story page only. The dashboard never pins |
| **Lazy act build** | Acts below the hero queue in `useAct`; an `IntersectionObserver` (`rootMargin: 0 0 100% 0`) builds them in document order. In-page links call `jumpToAct(id)` | `story/motion.ts` | Every new act must use `useAct`, never raw `useGSAP` |
| **Timed release inside a scrub** | Scrub builds tension; crossing a threshold (the `onUpdate` callback of `actTimeline`) plays a paused timeline (`shot.play()`), scrolling back reverses it at 3× | `story/acts/launch.tsx` (`FIRE_AT`) | Only for moments that can't happen halfway |
| **Masked type reveal** | `SplitText.create(el, { type: 'words', mask: 'words' })`, then `from(words, { yPercent: 110, ease: settle })`. Hero uses lines + `autoSplit`; the coda uses chars | `story/acts/hangar.tsx`, `deck.tsx`, `fleet.tsx` (`Coda`) | Headlines only. Never on body copy or dashboard text |
| **Parallax layers** | 3+ layers on one `.story-stage` box, each moving at a different rate: stars ≈ 3–8%, horizon ≈ 12%, scene 100%, rulers 45% | `story/acts/crew.tsx` | Story only |
| **Camera move** | Scale or translate a wrapper, origin at the subject; `throttle` to push in, `glide`/`settle` to pull back | `deck.tsx` (push), `squadron.tsx` (pull back from the lead jet) | Story only |
| **Vehicle on a path** | SVG `<g>` in stage units, `svgOrigin` at the pivot, path strings built from named constants, `autoRotate`; durations derived from path length and the speed handed over from the previous tween (§2.6) | `story/acts/launch.tsx` (`CLIMB`), `squadron.tsx` (`BREAK`, `PATTERN`, `ROLLOUT`) | Any flight or taxi that isn't a straight line |
| **Launch impact** | Flash (white overlay 0 → 0.55 → 0), shake keyframes ±12px decaying over 0.55s, 14 speed lines, a shockwave ring, camera settle | `story/acts/launch.tsx` (`shot`) | **Launch only.** The squadron trap gets a ±4px echo (`squadron.tsx`). Nowhere else |
| **Dashboard reveal** | Mark children `data-reveal`; call `useReveal(scope, ready)`. Staggers `y: 14 → 0`, `DUR.slow`, `settle`, `STAGGER.tight`, once | `routes/dashboard.tsx` | Every dashboard page. The only entrance animation the app UI uses |
| **Count-up** | `useCountUp(ref, value)` tweens from the previous value, `DUR.slow`, `settle` | `routes/dashboard.tsx` (`Stat`) | Numbers that summarise state |
| **Flight path** | Stage progress read from the build's log lines; CSS transitions on `scaleX` (track) and `translateX` (jet) | `components/flight-path.tsx` | Any multi-stage pipeline progress |
| **Log line in** | `.log-line` keyframe: `opacity 0, translateX(-6px)` → rest, 0.24s `--ease-settle` | `app.css`, `components/log-stream.tsx` | Streamed lines only |
| **Popups** | Base UI + `tw-animate-css` (`data-open:animate-in fade-in-0 zoom-in-95`), `duration-quick ease-settle`, `motion-reduce:animate-none` | `components/ui/select.tsx`, `ui/alert-dialog.tsx` | All menus, dialogs, popovers |

---

## 4. Visual tokens

### 4.1 Color — `app.css` `@theme`

| Role | Token | Value | Notes |
|---|---|---|---|
| Base (page) | `night-950` | `#03050a` | `--background` |
| Panel surface | `night-900` | `#060a13` | `--card`, fields, `.panel` |
| Floating surface | `night-850` | `#0a101d` | `--popover`: menus, dialogs, toasts |
| Raised / muted | `night-800` | `#0f1728` | `--muted`, `--secondary`, skeletons |
| Highlight | `night-700` | `#172238` | `--accent`: hovered menu items |
| Deep line | `night-600` | `#22314d` | Track rails, unvisited nodes |
| Hairline | `line` | `rgb(143 170 220 / 0.16)` | `--border`. Field outlines use `--input` (`/ 0.24`) |
| Text primary | `steel-100` | `#e8ecf3` | `--foreground` |
| Text secondary | `steel-300` | `#b7c0d0` | Lede, body on dark panels |
| Text tertiary | `steel-400` | `#8f9bb2` | `--muted-foreground`, labels |
| Text quiet | `steel-500` | `#6b7891` | Placeholders, metadata, ids |
| Deck light (accent) | `deck-400` | `#ffb24a` | `--primary`, `--ring`, eyebrows, active, building |
| Deck light soft | `deck-300` | `#ffd391` | Hover on primary, deploying, rollback notes |
| Deck light deep | `deck-500` | `#f39a1f` | Gradients only |
| Live | `signal-400` | `#46e39a` | Running, live URL, success. Green means live, nothing else |
| Live surface | `signal-950` | `#0c1e18` | Opaque background of live URL cards and pills |
| Alarm | `alarm-400` | `#f2676b` | `--destructive`, failed, errors |
| Alarm solid | `alarm-500` | `#e5484d` | The solid `danger` button only |

Status colours live in one place: `STATUS` in `lib/status.ts` (`dot`, `text`, `ring`, and `glyph` for jet icons).

### 4.2 Type — font roles

| Role | Token | Font | Use |
|---|---|---|---|
| Display | `font-display`, `.display` | Big Shoulders Display, 800, uppercase, `line-height: .88` | Headlines, section titles, stage labels |
| Text | `font-sans` | Inter | Body, buttons, descriptions |
| Code | `font-code` | JetBrains Mono | IDs, URLs, logs, labels, eyebrows, chips |

| Style | Classes | Reference |
|---|---|---|
| Hero | `display text-display-hero` (clamp 3rem → 8.25rem) | `story/acts/deck.tsx` |
| Act title | `display text-display-act` (clamp 2.5rem → 5rem) | Every story act, including the fleet |
| Finale | `display text-display-finale` (clamp 3.25rem → 10rem) | `story/acts/fleet.tsx` (`Coda`) |
| Door stencil | `text-stencil` (`min(22vh, 24vw)`) | `story/acts/hangar.tsx` |
| Page title | `display text-6xl md:text-8xl` (list) / `text-5xl md:text-7xl` (others) | `routes/dashboard.tsx`, `dashboard.deployments.$id.tsx` |
| Section / card title | `font-display text-xl–3xl font-bold uppercase tracking-wide` | `deploy-form.tsx` `Section`, `crew.tsx` cards |
| Eyebrow | `.eyebrow`: mono 11px, `tracking-[0.22em]`, uppercase, `deck-400` | Everywhere above a title |
| Field label | `Label`: `font-code text-micro` (10px), `tracking-[0.2em]`, uppercase, `steel-400` | `components/ui/label.tsx` |
| Metadata | `font-code text-mono` (11px) `text-steel-500` | List rows, build rows |
| Logs | `font-code text-mono md:text-xs` | `log-stream.tsx`, launch console |
| Button | `text-button` (15px) / `text-button-sm` (13px) | `ui/button.tsx` |
| Body | `text-sm leading-relaxed text-steel-300/400` (dashboard), `text-base md:text-lg` (hero) | — |

### 4.3 Space, radius, border, shadow

| Token | Value | Where |
|---|---|---|
| Page width | `max-w-6xl` (dashboard), `max-w-[1440px]` (story) | Layout containers |
| Page gutter | `px-5 md:px-8` (dashboard), `px-5 md:px-10` (story) | — |
| Section rhythm | `mt-10`–`mt-12` between blocks, `gap-4` in grids | — |
| `rounded-lg` | `--radius` = 0.625rem (10px) | Fields, selects, field-height icon buttons |
| `rounded-xl` | `--radius-xl` = 0.875rem | `.panel`, toasts, select menus |
| Pills | `rounded-full` | All buttons, status badges, chips |
| Dialog | `rounded-2xl` | `alert-dialog.tsx` |
| Border | `1px` `border-line`; dashed for "not yet" (empty live URL, roadmap escorts) | — |
| Primary glow | `inset 0 0 0 1px rgb(255 211 145/.4), 0 10px 40px -10px rgb(255 178 74/.6)` | `ui/button.tsx` default |
| Popover shadow | `0 24px 60px -12px rgb(0 0 0/.85)` | Select, toasts |
| Dialog shadow | `0 40px 100px -20px rgb(0 0 0/.9)` | Alert dialog |

### 4.4 Atmosphere

| Element | Class | Rule |
|---|---|---|
| Film grain | `.grain` | Fixed, 7% opacity, static. Mounted once in `root.tsx` |
| Blueprint grid | `.blueprint-grid` | 120px major / 24px minor lines. Behind page heads, masked to fade (`[mask-image:linear-gradient(...)]`) |
| Deck glow | `bg-deck-400/10 blur-3xl` blob | One per page head. Turns `signal-400/10` when the deployment is live |
| Ocean | `.ocean` | Plan-view water for top-down scenes |

### 4.5 Illustration — `story/art/`

- **Silhouettes, not drawings.** Flat fills, no outlines on solid shapes. Jets come in two views: `JetSide` (nose right) and `JetPlan` (nose up), from shared path constants so every jet matches.
- **Palette.** Every art colour is a named role in `story/art/palette.ts` (`ART.hull`, `ART.jet`, `ART.skyLow`, …); it is the only file allowed hex. Reuse a role before adding one. Jet tones: `silhouette` (near-black against light) and `steel` (`ART.jet` body, `ART.jetShade` shade, `ART.canopy` canopy).
- **Dashboard jets** (`JetPlan` without `color`) take `currentColor`, so they're tinted with classes: `STATUS[status].glyph` in lists, `text-deck-400`/`text-alarm-400` on the flight path.
- **Blueprint overlays.** 0.8–1px strokes at `rgb(143 170 220 / .45–.7)`; dimension lines via `Dimension`; labels in `font-code` with wide tracking.
- **Light.** Amber radial gradients for deck and bay light; green only on the catapult track and live states.
- **Text in SVG is decorative only** and the SVG is `aria-hidden`. Real content is HTML.
- **Coordinates.** Scenes are drawn on a 1600×900 stage (`.story-stage`) so layers stay registered.

---

## 5. Components

Shared UI lives in `components/ui/` (shadcn, Base UI style `base-nova`, Hugeicons). App components live in `components/`.

| Component | Props / variants | States | Example |
|---|---|---|---|
| `Button` (`ui/button.tsx`) | `variant`: `default` (amber), `outline`, `secondary`, `ghost`, `destructive` (red outline, opens a confirm), `danger` (solid red, the confirm itself), `link`. `size`: `default` (48px), `sm` (36px), `lg`, `icon`, `icon-sm` | hover lifts 1px, active settles, focus ring `ring-ring/35` + offset, disabled 45% | `<Button variant="outline" size="sm">Redeploy</Button>` |
| `buttonVariants()` | same options + `className` | — | `<Link className={buttonVariants({ size: 'sm' })}>` for links styled as buttons |
| `Input` (`ui/input.tsx`) | native input props | hover border `steel-500/60`, focus `border-ring` + `ring-3 ring-ring/20`, `aria-invalid` red, disabled | `<Input id="cpu" className="font-code" />` |
| `Label` (`ui/label.tsx`) | `htmlFor` | — | `<Label htmlFor="cpu" className="mb-2.5">CPU · MHz</Label>` |
| `Select` (`ui/select.tsx`) | Base UI `items`, `value`, `onValueChange`; `SelectTrigger size="sm"\|"default"` | trigger matches `Input`; open `border-ring/60`; item highlight `accent`; chosen item `deck-300` + amber tick; disabled items never highlight | `deployment-actions.tsx` rollback picker |
| `AlertDialog` (`ui/alert-dialog.tsx`) | `open`/`onOpenChange`; `AlertDialogMedia` for the icon; `AlertDialogCancel` (outline sm), `AlertDialogAction variant="danger"` | — | `deployment-actions.tsx` stop confirm |
| `Toaster` (`ui/sonner.tsx`) | mounted once in `root.tsx`; call `toast.success/error` | icons tinted signal/alarm/deck | `toast.success('Stood down', { description: '…' })` |
| `StatusBadge` | `status`, `className` | pulse while pending/building/deploying | `<StatusBadge status={deploymentStatus(d)} />` |
| `CopyButton` | `value`, `label` | tick for 1.5s after copy | Next to ids |
| `Header` | `action?`, `bare?` | active nav link `steel-100`; `bare` drops the nav (sign-in); Sign out sits last in the nav | Every dashboard page, `routes/sign-in.tsx` |
| `Mark` | `className` | — | Logo |
| `DeploymentList` | `deployments` | empty state built in | `routes/dashboard.tsx` |
| `FlightPath` | `lines`, `status` | done / active / waiting / skipped / failed per stage | `routes/dashboard.deployments.$id.tsx` |
| `BuildList` | `builds`, `selectedBuildId`, `onSelect` | selected bar `deck-400` | `routes/dashboard.deployments.$id.tsx` |
| `LogStream` | `lines`, `done`, `buildId` | Live pill / Stream closed | `routes/dashboard.deployments.$id.tsx` |
| `DeploymentActions` | `deploymentId`, `currentImageTag`, `status` | — | `routes/dashboard.deployments.$id.tsx` |
| `CallsignTitle` | `deployment` | view / editing / invalid / saving | `routes/dashboard.deployments.$id.tsx` |
| `DeployForm` | — | pending "Launching…", inline error | `routes/dashboard.deployments.new.tsx` |
| Classes | `.panel`, `.chip`, `.chip-coming`, `.eyebrow`, `.display`, `.live-dot` | — | `app.css` |

Hooks: `useReveal`, `useCountUp`, `registerEases` (`lib/motion.ts`); `useAct`, `pinLength`, `flushActs`, `jumpToAct` (`story/motion.ts`); `deploymentStatus` (`lib/status.ts`); `cn` (`lib/utils.ts`).

---

## 6. Interaction states

| State | Treatment | Reference |
|---|---|---|
| Hover | Buttons lift 1px (`settle`, 200ms). Rows tint `night-850`; the row jet nudges up 4px and the chevron slides 4px | `ui/button.tsx`, `deployment-list.tsx` |
| Focus | Fields: amber border + 3px `ring/20` halo. Buttons: 3px `ring/35` with 2px offset. Plain links: 2px amber outline (`@layer base`). Never two indicators at once | `ui/input.tsx`, `app.css` |
| Pressed | Button settles back to 0 (`active:translate-y-0`) | `ui/button.tsx` |
| Loading (page) | Skeleton bars `bg-night-700/800 animate-pulse` in the final layout's shape | `routes/dashboard.tsx` |
| Loading (action) | Button label changes ("Launching…", "Saving…", "Stopping…"); spinner or `animate-spin` icon; button disabled | `deploy-form.tsx`, `deployment-actions.tsx` |
| Empty | Panel + blueprint grid + dashed outline jet + eyebrow + display line + one primary CTA | `deployment-list.tsx` `EmptyHangar` |
| Error (page) | `.panel` with `eyebrow text-alarm-400!` ("No contact", "Lost contact") and the API's message in mono | `routes/dashboard.tsx` |
| Error (field/form) | `aria-invalid` red border + halo; message below in `font-code text-mono text-destructive` with `role="alert"` | `callsign-title.tsx`, `deploy-form.tsx` |
| Error (action) | `toast.error(title, { description: apiMessage })` | `deployment-actions.tsx` |
| Success | `toast.success` with a lore title and a literal description | `deployment-actions.tsx` |
| Disabled | 45% (buttons) / 50% (fields), no pointer events, no lift | `ui/*` |

### Status

`deploymentStatus(d)` (`lib/status.ts`) is the only way to derive a deployment's status: the latest build wins while in flight, but a stopped deployment is never shown as running.

| Status | Label | Color | Motion |
|---|---|---|---|
| `pending` | Queued | `steel-400` | dot pings |
| `building` | Building | `deck-400` | dot pings; flight-path node pings |
| `deploying` | Deploying | `deck-300` | dot pings |
| `running` | Running | `signal-400` | still; live URL card turns green, page glow turns green |
| `failed` | Failed | `alarm-400` | still; flight-path jet turns red and stops at the failed stage |
| `stopped` | Stopped | `steel-500` | still; live card reads "Stood down." |

Map lives in `STATUS` (`lib/status.ts`). Jet tints in `deployment-list.tsx` (`JET_TONE`) mirror it.

---

## 7. Content and voice

- **Tone.** Confident, short, technical. Say what the system does in its own terms (Nomad, Consul, Vault, Caddy, Railpack, BuildKit).
- **Headlines.** Display, uppercase, 2–5 words, end with a period: "Built in the bay.", "Zero to airborne.", "Nothing on deck yet."
- **Eyebrows.** Location or act, mono uppercase: "Flight deck", "Pre-flight", "Act IV · Launch".
- **CTAs.** Verb first, specific: "Deploy your first app", "Launch", "Redeploy", "Roll back", "Stop deployment". Cancels can carry lore: "Keep it flying".
- **Copy length.** Ledes ≤ 2 sentences. Card bodies are one line. Labels are 1–3 words.
- **Lore vocabulary.** deck, bay, hangar, crew, sortie, flight path, flight log, pre-flight, callsign, airborne, cleared for launch, stood down, grounded, squadron, fleet.
  - **Allowed** in headings, eyebrows, empty states, toast titles, dialog titles and button labels for destructive cancel paths.
  - **Not allowed** in IDs, URLs, log lines, error descriptions or anything a user copies. Pair every lore title with a literal description: "Stood down" + "Nomad job stopped and Caddy route removed."
- **Honest claims.** Every product statement must match the code or README. Roadmap items carry the `chip-coming` "Coming" label (`story/acts/fleet.tsx`). Example data uses real formats: `dep-<nanoid>` ids, uuidv7 build ids, `http://<id>.localhost` live URLs (`story/data.ts`).

---

## 8. Accessibility and performance

**Reduced motion.** `gsap.matchMedia` gates all story motion on `(prefers-reduced-motion: no-preference)` (`useAct`). With reduce, nothing pins and each act shows its composed final frame.

| Pattern | Reduced-motion behavior |
|---|---|
| Story acts | Static final frame per act, normal document flow |
| Hero intro | Copy visible immediately (the intro guard only installs with motion) |
| `useReveal`, `useCountUp` | Skip; values set directly |
| Popups | `motion-reduce:animate-none` |
| Flight path | `motion-safe:` transitions only |
| Log lines | `.log-line` animation only under `no-preference` |
| Pings and spinners | Still run (status meaning); keep them small |

**Contrast.** Body text is `steel-300` or brighter on `night-900/950`. `steel-500` is for metadata and placeholders only, never essential copy.

**Focus.** Every interactive element has a visible focus state (§6). Dialogs return focus to their trigger; `CallsignTitle` returns focus to the pencil.

**Semantics.** Real headings per section, `aria-hidden` art, `role="log"` + `aria-live="polite"` on logs, `role="alert"` on field errors, and a skip link on the story page.

**Transform and opacity only.** Motion code animates `transform` and `opacity`. Color changes are cross-fades between two layers (the live URL pill in `launch.tsx`). CSS transitions on `border-color`, `background-color` and `box-shadow` are allowed for interactive states.

**Loading.** The hero builds at load; acts below build lazily in document order (`story/motion.ts`). Fonts are self-hosted (`@fontsource-variable`). Icons are individual imports.

**Budgets** (measured with Lighthouse on the production build):

| Metric | Budget | Last measured |
|---|---|---|
| LCP (desktop) | < 2.5s | 0.8s |
| CLS | 0 | 0 |
| Lighthouse performance (desktop) | ≥ 90 | 99 |
| TBT (desktop) | — | 30ms |
| Lighthouse performance (mobile) | — (known gap) | 71 |
| Scroll frame time | 60fps median | 16.7ms median, prebuilt acts |

---

## 9. Responsive rules

Breakpoint is `md` (768px), the same one `useAct` uses for `isDesktop`.

- **Re-compose, don't shrink.** Each story stage has a mobile class that re-frames the scene (`.hero-stage`, `.crew-stage`, `.launch-stage`, `.fleet-stage` in `story/story.css`): shorter, and re-centred on the subject.
- **One at a time on mobile.** Crew cards stack and swap instead of showing four in a row (`crew.tsx`).
- **Shorter pins.** Mobile `PIN` values are 20–40 points shorter.
- **Dashboard.** Grids collapse to one column; secondary metadata hides below `md` (Visit link, timestamps); tracker labels shrink and hide their subtitles.
- **Never scroll sideways.** Every route's `scrollWidth` must equal the viewport at 390px. Grid children with long text need `grid-cols-1`/`min-w-0`.
- **Check both.** 1440×900 and 390×844, motion on and off.

---

## 10. Do / Don't

| Do | Don't |
|---|---|
| `ease: EASE.settle` | `ease: 'power3.out'`, `'ease'`, `'linear'` |
| `duration: DUR.slow` in time-based tweens | `duration: 0.8` |
| `className="ease-settle duration-quick"` | `transition-all` with no curve, or `duration-300` |
| `text-mono`, `text-micro`, `text-display-act` | `text-[11px]`, `text-[clamp(...)]` |
| `JetPlan className={STATUS[s].glyph}` | `JetPlan color="#46e39a"` |
| `line.includes(PIPELINE_LOG.live)` | `line.includes('Live at')` |
| `text-deck-400`, `bg-card`, `border-line` | `text-[#ffb24a]`, `bg-white`, `text-white` |
| `<Button variant="destructive">` → dialog → `variant="danger"` | `confirm()` |
| Base UI `Select` | native `<select>` |
| `deploymentStatus(d)` | `d.latestBuild?.status ?? d.status` |
| `<Link to={paths.deployment(id)}>` | `` to={`/deployments/${id}`} `` |
| `buttonVariants({ variant: 'outline' })` on a `Link` | Copying button classes by hand |
| Lore title + literal description in toasts | Lore in error messages or IDs |
| Impact effects only in the launch | Shaking the page on a successful save |
| `useReveal(scope, !isLoading)` | Re-running entrances on every refetch |
| Roadmap features with a "Coming" chip | Shipping copy that implies multi-node works today |
| Name things so the code explains itself; leave a `TODO` for unfinished work | Comments in app code (see `CLAUDE.md`, Code Comments) |

---

## 11. The dashboard

**The story page is the airshow; the dashboard is the instrument panel.** Same palette, type and curves, at a fraction of the volume. People read it, scan it and act on it many times a day, so it stays still unless the data changes. No pinning, no scroll choreography, no camera moves, no SplitText, no impact effects.

### 11.1 Page template

Every dashboard page stacks the same layers. Copy them from the nearest page rather than rebuilding.

| Layer | Recipe | Reference |
|---|---|---|
| Header | `Header`, sticky, `h-16`, `bg-night-950/85 backdrop-blur-md border-b border-line`, content `max-w-6xl px-5 md:px-8`. Mark + wordmark left, nav (`Deployments`, `Docs`), at most one action right | `components/header.tsx` |
| Atmosphere | One absolute layer behind the page head: `.blueprint-grid` masked to fade downward (`[mask-image:linear-gradient(to_bottom,black,transparent)]`, `h-[420px]`–`h-[480px]`) plus one `blur-3xl` glow blob at `/10` opacity. Glow is `deck-400`, or `signal-400` when the subject is live | `routes/dashboard.tsx`, `routes/dashboard.deployments.$id.tsx` |
| Main | `relative mx-auto max-w-6xl px-5 md:px-8 pb-20`, `pt-10`–`pt-16` | All three routes |
| Back link | Only on pages below the list: mono 11px uppercase `tracking-[0.16em] text-steel-400`, `ArrowLeft01Icon`, hover `steel-100` | `routes/dashboard.deployments.$id.tsx`, `dashboard.deployments.new.tsx` |
| Page head | `.eyebrow` (place, not decoration), then `.display` title `mt-4`. Status badge sits next to the eyebrow; actions or stats align to the title's baseline on the right (`lg:items-end lg:justify-between`) | `routes/dashboard.tsx` (stats), `dashboard.deployments.$id.tsx` (actions) |
| Content | `.panel` blocks separated by `mt-4` (related) or `mt-10`–`mt-12` (new section). Section labels above panels use `.eyebrow mb-3` | `routes/dashboard.deployments.$id.tsx` |

### 11.2 Surfaces and selection

- **Three levels only:** page (`night-950`) → panel (`.panel`: `night-900` at 85%, `border-line`, `0.875rem` radius) → floating (`popover`, `night-850`: menus, dialogs, toasts). Don't nest panels in panels.
- **Lists live inside one panel,** divided by `divide-y divide-line`, not as a stack of separate cards (`deployment-list.tsx`, `build-list.tsx`).
- **Hover** tints a row to `night-850` (list) or `night-900` (build log) with `duration-quick ease-settle`.
- **Selection** is a 2px `deck-400` bar on the row's left edge that scales in (`scale-y-0 → 100`, `duration-base ease-settle`) plus a `night-850` tint (`build-list.tsx`).
- **"Not yet" is dashed.** A missing live URL renders as `.panel border-dashed` with a grey dot, never an empty box (`dashboard.deployments.$id.tsx`).
- **Live is a surface change, not just a dot.** The live URL card switches to `border-signal-400/40` on a green-tinted surface with `.live-dot`; the page glow turns green with it.

### 11.3 Anatomy

| Piece | Structure | Reference |
|---|---|---|
| List row | `[JetPlan tinted by status] [callsign · text font] / [repo · id, mono 11px steel-500] … [StatusBadge] [Visit, md+, running only] [time + chevron, md+]`. The callsign is a stretched link (`after:absolute after:inset-0`); Visit sits above it with `relative z-10` so links never nest | `components/deployment-list.tsx` |
| Stat | `.display` number `text-4xl md:text-5xl tabular-nums` in its status color, mono 10px label below, `border-l border-line pl-4`. Four in a row: Running, In flight, Failed, Total | `routes/dashboard.tsx` |
| Detail head | Eyebrow + `StatusBadge`; `CallsignTitle`; a mono line with id + `CopyButton` and the source link; `DeploymentActions` on the right | `routes/dashboard.deployments.$id.tsx` |
| Detail body | Live card + facts panel (`lg:grid-cols-[1.3fr_1fr]`) → `FlightPath` → flight log + logs (`md:grid-cols-[280px_1fr]`) | `routes/dashboard.deployments.$id.tsx` |
| Form | Explainer column left (`md:grid-cols-[340px_1fr]`, sticky on desktop) + one `.panel` of numbered sections: mono `01` in `deck-400`, display title, one-line description, then fields. Footer bar `bg-night-850/60 border-t`: inline error left, the single primary action right | `routes/dashboard.deployments.new.tsx`, `components/deploy-form.tsx` |
| Facts | `<dl>` grid; `<dt>` mono 10px uppercase `steel-500`, `<dd>` `text-sm steel-300`, truncated | `routes/dashboard.deployments.$id.tsx` (`Fact`) |

### 11.4 Data typography

- **Machine values are mono:** ids, URLs, image tags, log lines, timestamps, field values for keys and numbers (`font-code`). They truncate with `truncate` rather than wrap, except log lines, which wrap (`break-words`).
- **Human names are text font:** callsigns in lists, repo names, descriptions. A callsign becomes `.display` only as a page title.
- **Numbers that change in place are `tabular-nums`** so they don't jitter (stats, CPU and memory fields).
- **Relative time** (`formatRelativeTime`) in lists; absolute dates only in facts.

### 11.5 Color restraint

- **One amber primary per view.** The list's primary is the header's "New deployment"; the form's is "Launch"; the detail page has none (its actions are `outline`, and Stop is `destructive`).
- **Amber means action or progress** (primary buttons, focus, building/deploying, active stage, selection). **Green means live** and nothing else. **Red means failed or destructive.** Everything else is steel on night.
- Status color appears on the badge, the row's jet and the stat, never as a row or page background.

### 11.6 Motion on the dashboard

| Moment | Motion | Reference |
|---|---|---|
| Page arrives | `useReveal` once: `[data-reveal]` children rise 14px and fade in, `DUR.slow`, `settle`, `STAGGER.tight`. Mark the blocks a reader scans, not every element | `routes/dashboard.tsx` |
| Numbers | `useCountUp` from the previous value | `routes/dashboard.tsx` |
| Status change | Badge, node and track colors transition (`duration-base`/`duration-slow`); in-flight statuses ping. Nothing moves position | `components/status-badge.tsx`, `flight-path.tsx` |
| Progress | The flight-path jet and track move with CSS transforms; when live, the jet throttles off (`ease-throttle`) and fades | `components/flight-path.tsx` |
| New log line | `.log-line` slide-in (0.24s); the panel follows the tail itself (`scrollTop`), never the page | `components/log-stream.tsx` |
| Feedback | Toasts for action results; button label swaps for pending ("Saving…") | `components/deployment-actions.tsx` |
| Overlays | Select and dialog open/close via `tw-animate` on `ease-settle`, 200ms | `components/ui/*` |

### 11.7 Live data

- **Poll faster while something is in flight:** lists and the deployment refetch every 2s while any status is `pending`/`building`/`deploying`, otherwise every 10s; builds and health every 5s (`routes/dashboard.tsx`, `routes/dashboard.deployments.$id.tsx`). Logs stream over SSE.
- **Refetches are silent.** No skeletons, no re-reveal, no layout shift. Skeletons appear only on the first load.
- **Mutations invalidate** the deployment, its builds and the list (`deployment-actions.tsx`), or write the response straight into the cache (`callsign-title.tsx`).

### 11.8 Lore on the dashboard

Lore names places and moments; plain words name data. Eyebrows and section labels: "Flight deck", "Pre-flight", "Flight path", "Flight log". Toast titles and dialog copy: "Cleared for launch", "Stood down", "Keep it flying". Status labels stay literal (Running, Failed, Stopped) and so do field labels (Repository URL, CPU · MHz).

---

## 12. Brand

**The mark is a squadron shield.** An amber top band is the hangar door; beneath it a delta lifts off a deck line: out of the hangar, off the deck. The **emblem** puts that shield between aviator wings, for ceremonial moments. Geometry lives in `app/lib/brand.ts`; colours come from tokens.

| Asset | Component / file | Use | Minimum |
|---|---|---|---|
| Shield | `<Mark />` (`components/mark.tsx`) | Header and nav lockups, footer, anywhere the brand is small | 16px |
| Emblem | `<Emblem />` (`components/emblem.tsx`) | Landing finale (`Coda`), social card. Never in UI chrome | 48px tall |
| Favicon / app icons | `public/favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `brand/icon-*.png`, `site.webmanifest` | Browser tabs, home screens | — |
| Social card | `public/brand/og.png` (1200×630) | `og:image` / `twitter:image` on `/` | — |

**Lockup.** Shield + `HANGAR` in `font-display` bold uppercase `tracking-wide`, `gap-2.5`, shield `h-7 w-7` next to `text-xl` (`components/header.tsx`, `story/nav.tsx`).

**Rules**
- Place the shield on night surfaces. On light surfaces, use the tiled favicon version (`favicon.svg`), never the bare shield.
- Keep clear space of at least half the shield's width around it.
- Two colours only: `deck-400` and `night-950`. Don't recolour, outline, add shadows, rotate or stretch it.
- Don't redraw it or put a literal plane back; change `lib/brand.ts` and regenerate.

**Regenerating assets.** After changing `lib/brand.ts` or the palette, run `pnpm --filter @hangar/web brand` (`scripts/generate-brand.mjs`; needs `npx playwright install chromium` once). It reads colours from `app.css` and rewrites every file in the table above.

## Find the precedent

| Doing this | Start from |
|---|---|
| Create / deploy | `components/deploy-form.tsx`, `routes/dashboard.deployments.new.tsx` |
| Sign in / single-field form | `routes/sign-in.tsx` (page head + one `.panel` form with the footer bar; a 401 anywhere redirects here via `root.tsx`) |
| Redeploy | `components/deployment-actions.tsx` (`redeploy`) |
| Rollback / choose from a list | `components/deployment-actions.tsx` (Base UI `Select`) |
| Destructive confirm | `components/deployment-actions.tsx` (`AlertDialog`) |
| Inline rename / edit in place | `components/callsign-title.tsx` |
| Stream logs | `components/log-stream.tsx`, `lib/use-log-stream.ts` |
| Pipeline progress | `components/flight-path.tsx` |
| Status change | `lib/status.ts`, `components/status-badge.tsx` |
| Summary numbers | `routes/dashboard.tsx` (`Stat` + `useCountUp`) |
| Empty state | `components/deployment-list.tsx` (`EmptyHangar`) |
| Page-level error | `routes/dashboard.tsx` (`isError` panel) |
| Toast feedback | `components/deployment-actions.tsx` |
| List row → detail | `components/deployment-list.tsx` (stretched link) → `routes/dashboard.deployments.$id.tsx` |
| Link to an app page | `lib/paths.ts` (`paths.dashboard`, `paths.newDeployment`, `paths.deployment(id)`) |
| New dashboard page | Register it under `dashboard/` in `routes.ts` and add it to `lib/paths.ts`; §11.1 template; copy `routes/dashboard.deployments.$id.tsx` (detail) or `routes/dashboard.deployments.new.tsx` (form) |
| Page entrance | `useReveal` in `routes/dashboard.tsx` |
| Page transition | None yet: route changes are instant. Add one to this guide before building it |
| Story scene | `story/acts/hangar.tsx` (clearest scrubbed act), `story/motion.ts` |
| Logo, icon, social card | `components/mark.tsx`, `components/emblem.tsx`, `scripts/generate-brand.mjs` (§12) |

## New-feature checklist

- [ ] Found the closest precedent above and followed it
- [ ] Tokens only: `pnpm --filter @hangar/web lint` passes; any new token is registered in `lib/utils.ts`
- [ ] Every state covered: loading, empty, error, success, disabled
- [ ] Reduced motion handled; content visible without JavaScript
- [ ] Checked at 390px and 1440px; no sideways scroll
- [ ] Dashboard work follows §11: page template, one amber primary, silent refetches, no story choreography
- [ ] Copy follows §7; any claim matches the code
- [ ] No comments added except `TODO`/`FIXME` or a `tokens-ok` marker
- [ ] If a new pattern was introduced, this guide is updated in the same change

## Guardrails

| Kind of value | Lives in | Notes |
|---|---|---|
| Colours | `app.css` `@theme`; story art in `story/art/palette.ts` | Status colours via `STATUS` (`lib/status.ts`) |
| Easing, duration, stagger | `lib/motion.ts` (`EASE`, `DUR`, `STAGGER`); CSS twins `--ease-*`, `--dur-*` in `app.css` | Keep both sides in step |
| Type sizes, radii | `app.css` `@theme` (`--text-*`, `--radius`) | |
| Page paths | `lib/paths.ts` | |
| Pipeline log text | `PIPELINE_LOG` in `packages/types/src/index.ts` | The API writes it; the flight path and the story read it |

- **Register custom tokens with `cn`.** `cn` (`lib/utils.ts`) only knows Tailwind's built-in scale. A new `--text-*`, `duration-*` or `ease-*` token must be added to its `classGroups`, or `cn` silently drops it whenever a same-prefix class is also present (e.g. `text-micro` next to `text-steel-500`).
- **Lint.** `pnpm --filter @hangar/web lint` runs `check:tokens --strict` and fails on hex outside the token files, quoted easings, numeric `duration-N`, pixel or `clamp()` text sizes, arbitrary radii, raw timeouts and raw seconds outside `story/`. It's part of `turbo run lint`.
- **Escape hatch.** A line that must hold a literal (the `theme-color` meta tag) carries a `tokens-ok: <reason>` comment.
