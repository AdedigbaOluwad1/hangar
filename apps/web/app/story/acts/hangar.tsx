import { useRef } from 'react';
import { DUR, EASE, STAGGER, SplitText, actTimeline, gsap, useAct } from '../motion';
import { CANOPY, FIN, FUSELAGE, JetSide, STAB, WING } from '../art/jet';
import { Dimension } from '../art/scenery';
import { REGISTRY_REPO, REGISTRY_TAGS, SHORT_ID } from '../data';
import { ART } from '../art/palette';

const STEPS = [
	{
		n: '01',
		title: 'Clone',
		body: 'Git URL in. Shallow clone.',
		status: 'git clone --depth=1',
	},
	{
		n: '02',
		title: 'Detect',
		body: 'Railpack picks the build plan. No Dockerfile.',
		status: 'railpack · analysing app',
	},
	{
		n: '03',
		title: 'Build',
		body: 'BuildKit builds, reusing cached layers.',
		status: 'buildkit · building image',
	},
	{
		n: '04',
		title: 'Push',
		body: 'Tagged into the local registry.',
		status: 'registry · image pushed',
	},
];

const BEAT = { open: 0.03, clone: 0.22, detect: 0.38, build: 0.52, push: 0.76 };

export function HangarAct() {
	const ref = useRef<HTMLElement>(null);

	useAct(ref, ({ isDesktop, q }) => {
		const title = SplitText.create(q('[data-title]'), {
			type: 'words',
			mask: 'words',
		});

		const tl = actTimeline(ref.current, 'hangar', isDesktop);

		tl.fromTo(
			q('[data-seam]'),
			{ autoAlpha: 0.2, scaleX: 0.4 },
			{ autoAlpha: 1, scaleX: 1, duration: 0.05, ease: EASE.spool },
			0,
		)
			.fromTo(
				q('[data-door-l]'),
				{ xPercent: 0, autoAlpha: 1 },
				{ xPercent: -101, duration: 0.19, ease: EASE.glide },
				BEAT.open,
			)
			.fromTo(
				q('[data-door-r]'),
				{ xPercent: 0, autoAlpha: 1 },
				{ xPercent: 101, duration: 0.19, ease: EASE.glide },
				BEAT.open,
			)
			.to(q('[data-seam]'), { autoAlpha: 0, duration: 0.06 }, BEAT.open + 0.1)
			.from(q('[data-lights]'), { autoAlpha: 0, duration: 0.2, ease: EASE.settle }, BEAT.open + 0.04)
			.fromTo(
				q('[data-grid]'),
				{ scale: 1.08, yPercent: 0 },
				{ scale: 1, yPercent: -3, duration: 1, ease: EASE.settle },
				0,
			)
			.fromTo(
				q('[data-assembly]'),
				{ scale: isDesktop ? 0.9 : 0.94 },
				{ scale: 1, duration: 0.9, ease: EASE.settle },
				0.08,
			)

			.from(q('[data-eyebrow]'), { autoAlpha: 0, y: 12, duration: 0.06, ease: EASE.settle }, 0.12)
			.from(title.words, { yPercent: 110, duration: 0.1, ease: EASE.settle, stagger: 0.012 }, 0.13)
			.from(q('[data-lede]'), { autoAlpha: 0, y: 14, duration: 0.08, ease: EASE.settle }, 0.17)
			.from(
				q('[data-step]'),
				{
					autoAlpha: 0,
					y: 14,
					duration: 0.06,
					ease: EASE.settle,
					stagger: 0.012,
				},
				0.18,
			)

			.from(q('[data-outline] path'), { drawSVG: '0%', duration: 0.14, ease: EASE.glide, stagger: 0.012 }, BEAT.clone)
			.fromTo(
				q('[data-scan]'),
				{ x: -30, autoAlpha: 0 },
				{ x: 430, autoAlpha: 1, duration: 0.13, ease: EASE.glide },
				BEAT.detect,
			)
			.to(q('[data-scan]'), { autoAlpha: 0, duration: 0.02 }, BEAT.detect + 0.12)
			.from(
				q('[data-part="fuselage"], [data-part="panels"]'),
				{ autoAlpha: 0, duration: 0.1, ease: EASE.settle },
				BEAT.detect + 0.03,
			)
			.from(q('[data-part="wing"]'), { y: 60, autoAlpha: 0, duration: 0.07, ease: EASE.snap }, BEAT.build)
			.from(q('[data-part="fin"]'), { y: -70, autoAlpha: 0, duration: 0.07, ease: EASE.snap }, BEAT.build + 0.035)
			.from(q('[data-part="stab"]'), { x: -60, autoAlpha: 0, duration: 0.07, ease: EASE.snap }, BEAT.build + 0.07)
			.from(
				q('[data-part="intake"], [data-part="nozzle"]'),
				{ x: 40, autoAlpha: 0, duration: 0.06, ease: EASE.snap, stagger: 0.02 },
				BEAT.build + 0.1,
			)
			.from(q('[data-part="canopy"]'), { y: -40, autoAlpha: 0, duration: 0.06, ease: EASE.snap }, BEAT.build + 0.14)
			.from(
				q('[data-part="gear"]'),
				{
					scaleY: 0,
					transformOrigin: '50% 0%',
					duration: 0.05,
					ease: EASE.snap,
				},
				BEAT.build + 0.18,
			)
			.to(q('[data-outline]'), { autoAlpha: 0.25, duration: 0.08 }, BEAT.build + 0.1)
			.from(q('[data-registry]'), { autoAlpha: 0, y: 20, duration: 0.06, ease: EASE.settle }, BEAT.push)
			.from(
				q('[data-tag]'),
				{
					autoAlpha: 0,
					x: -24,
					duration: 0.06,
					ease: EASE.snap,
					stagger: STAGGER.tight / 2,
				},
				BEAT.push + 0.04,
			);

		const beats = [BEAT.clone, BEAT.detect, BEAT.build, BEAT.push];
		q('[data-step]').forEach((step, i) => {
			const start = beats[i];
			const end = beats[i + 1] ?? 1.1;
			const body = step.querySelector('[data-step-body]');
			tl.fromTo(body, { opacity: 0.38 }, { opacity: 1, duration: 0.02 }, start).fromTo(
				step.querySelector('[data-step-bar]'),
				{ scaleX: 0 },
				{ scaleX: 1, duration: end - start - 0.02, ease: EASE.scrub },
				start,
			);
			if (i < 3) tl.to(body, { opacity: 0.6, duration: 0.02 }, end);
		});
		q('[data-status]').forEach((line, i) => {
			const start = beats[i];
			tl.fromTo(line, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.03, ease: EASE.settle }, start);
			if (i < 3) tl.to(line, { autoAlpha: 0, y: -8, duration: 0.03 }, beats[i + 1] - 0.02);
		});

		return () => title.revert();
	});

	return (
		<section
			ref={ref}
			id="hangar"
			aria-labelledby="hangar-title"
			className="relative h-svh min-h-[640px] overflow-hidden bg-night-900"
		>
			<div
				data-grid
				aria-hidden="true"
				className="blueprint-grid absolute -inset-[6%] opacity-80 will-change-transform"
			/>
			<div data-lights aria-hidden="true" className="pointer-events-none absolute inset-0">
				<div className="absolute -top-1/4 left-[55%] h-[70%] w-[50%] -translate-x-1/2 rounded-full bg-deck-400/10 blur-3xl" />
				<div className="absolute bottom-0 left-[60%] h-[30%] w-[60%] -translate-x-1/2 rounded-full bg-deck-500/5 blur-3xl" />
			</div>

			<div className="relative z-10 mx-auto flex h-full max-w-[1440px] flex-col px-5 pb-6 pt-20 md:grid md:grid-cols-[minmax(0,360px)_1fr] md:items-center md:gap-14 md:px-10 md:py-0">
				<div className="contents md:block">
					<div className="order-1">
						<p data-eyebrow className="eyebrow">
							Act II · The Hangar
						</p>
						<h2 id="hangar-title" data-title className="display mt-3 text-display-act md:mt-5">
							Built in the bay.
						</h2>
						<p data-lede className="mt-3 max-w-sm text-sm leading-relaxed text-steel-300 md:mt-5 md:text-base">
							Push a Git URL. Hangar turns it into a container image without a Dockerfile.
						</p>
					</div>
					<ol className="order-3 mt-auto grid grid-cols-2 gap-x-4 gap-y-3 md:mt-10 md:grid-cols-1 md:gap-5">
						{STEPS.map((s) => (
							<li key={s.n} data-step className="relative pt-3">
								<span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-line" />
								<span
									data-step-bar
									aria-hidden="true"
									className="absolute inset-x-0 top-0 h-px origin-left bg-deck-400"
								/>
								<div data-step-body>
									<p className="flex items-baseline gap-2.5">
										<span className="font-code text-mono text-deck-400">{s.n}</span>
										<span className="font-display text-lg font-bold uppercase tracking-wide md:text-xl">{s.title}</span>
									</p>
									<p className="mt-0.5 text-xs leading-snug text-steel-400 md:text-sm">{s.body}</p>
								</div>
							</li>
						))}
					</ol>
				</div>

				<div data-assembly className="order-2 my-auto w-full py-6 md:my-0 md:py-0">
					<div className="relative mx-auto w-full max-w-[860px]">
						<svg viewBox="-20 -10 440 160" overflow="visible" className="w-full" aria-hidden="true">
							<Dimension x1={18} x2={398} y={140} label={`AIRFRAME · ${SHORT_ID}`} size={4.5} />
							<g data-outline fill="none" stroke="rgb(143 170 220 / 0.7)" strokeWidth="0.8">
								<path d={FUSELAGE} />
								<path d={FIN} />
								<path d={WING} />
								<path d={STAB} />
								<path d={CANOPY} />
							</g>
							<JetSide tone="steel" x="0" y="0" width="400" height="120" />
							<g data-scan opacity="0">
								<rect x="-8" y="-6" width="16" height="132" fill="rgb(255 178 74 / 0.12)" />
								<rect x="-0.75" y="-6" width="1.5" height="132" fill={ART.amber} />
							</g>
						</svg>

						<div className="relative mt-5 h-5 font-code text-xs text-steel-300 md:mt-6 md:text-button-sm">
							{STEPS.map((s, i) => (
								<p
									key={s.n}
									data-status
									className="absolute inset-0 flex items-center gap-2"
									style={i < STEPS.length - 1 ? { visibility: 'hidden' } : undefined}
								>
									<span className="text-deck-400">›</span> {s.status}
								</p>
							))}
						</div>

						<div
							data-registry
							className="mt-4 rounded-lg border border-line bg-night-850/95 p-3 font-code text-mono md:mt-6 md:p-4 md:text-xs"
						>
							<p className="truncate text-steel-400">{REGISTRY_REPO}</p>
							<ul className="mt-2 grid gap-1.5 md:grid-cols-3 md:gap-3">
								{REGISTRY_TAGS.map((t) => (
									<li
										key={t.tag}
										data-tag
										className="flex items-center justify-between gap-3 rounded border border-line px-2 py-1.5 md:flex-col md:items-start md:gap-0.5"
									>
										<span className="text-deck-300">:{t.tag}</span>
										<span className="text-steel-500">{t.note}</span>
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>
			</div>

			<div aria-hidden="true" className="pointer-events-none absolute inset-0 z-30">
				<div
					data-door-l
					className="hangar-door absolute inset-y-0 left-0 w-1/2 border-r border-night-600"
					style={{ visibility: 'hidden' }}
				>
					<span className="absolute bottom-[14%] right-[8%] font-display text-stencil font-extrabold leading-none text-night-600/70">
						HGR
					</span>
				</div>
				<div
					data-door-r
					className="hangar-door absolute inset-y-0 right-0 w-1/2 border-l border-night-600"
					style={{ visibility: 'hidden' }}
				>
					<span className="absolute bottom-[14%] left-[8%] font-display text-stencil font-extrabold leading-none text-night-600/70">
						02
					</span>
				</div>
				<div
					data-seam
					className="absolute inset-y-0 left-1/2 w-24 -translate-x-1/2 bg-gradient-to-r from-transparent via-deck-400/50 to-transparent"
					style={{ opacity: 0 }}
				/>
			</div>
		</section>
	);
}
