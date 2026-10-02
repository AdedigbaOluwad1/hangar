# Hangar

## Code Comments

No comments in app code (`apps/*`, `packages/*`): no file-path headers, no explanatory blocks, no end-of-line notes. The only exceptions are `TODO`/`FIXME` and the `// tokens-ok: <reason>` marker. This overrides any general guidance to comment the why. Applied migrations and generated files are never edited.

## Design & Motion Rules

Full guide: `docs/STYLE_GUIDE.md`. These rules are non-negotiable for anything in `apps/web`.

- **Find the precedent first.** Before building any screen, flow, component, or animation, find the closest existing instance (similar action, layout, state, or motion) and follow it very closely: same tokens, components, timing, structure and copy tone. Reuse before creating. A new pattern goes into the style guide in the same change.
- **Tokens only.** Never hardcode a color, duration, easing, or spacing value that has a token: colors from `app/app.css`, motion from `app/lib/motion.ts` (`EASE`, `DUR`, `STAGGER`) and `--ease-*` in CSS. `pnpm --filter @hangar/web lint` must pass. New `--text-*`, `duration-*` or `ease-*` tokens must be registered in `app/lib/utils.ts` or `cn` drops them.
- **Components.** Use `components/ui/` (shadcn on Base UI): `Button`/`buttonVariants`, `Input`, `Label`, `Select`, `AlertDialog`, toasts. No native `<select>`, no `confirm()`.
- **Status** comes from `deploymentStatus()` in `app/lib/status.ts`. Green means live, nothing else.
- **Dashboard is the instrument panel, the story page is the airshow.** Dashboard pages follow the template in guide §11: one amber primary per view, silent refetches, no pinning or scroll choreography.
- **Motion.** Animate transform and opacity only. Impact effects (shake, flash, speed lines) belong to the launch alone. Dashboard entrances use `useReveal` and play once. The story page uses `useAct`.
- **Reduced motion and no-JS** must still show complete content. Check 390px and 1440px; nothing scrolls sideways.
- **Brand.** Use `<Mark />` and `<Emblem />`; never redraw the logo. Change `app/lib/brand.ts` and run `pnpm --filter @hangar/web brand` to regenerate icons.
- **Honest copy.** Claims match the code; roadmap items carry the "Coming" chip. Lore words go in titles, never in IDs, logs or error text.
