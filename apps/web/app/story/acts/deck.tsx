// apps/web/app/story/acts/deck.tsx
//
// Act 1: dawn on the deck. A jet waits under a half-raised hangar door; scroll
// pushes the camera through the door into the bay.
import { useRef } from 'react';
import { Link } from 'react-router';
import { HugeiconsIcon } from '@hugeicons/react';
import { buttonVariants } from '../../components/ui/button';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { DUR, EASE, SCRUB, STAGGER, SplitText, gsap, pinLength, useAct } from '../motion';
import { releaseIntroGuard } from '../intro-guard';
import { DOCS_URL } from '../nav';
import { JetSide } from '../art/jet';
import { Dimension, StarField } from '../art/scenery';

// door is drawn closed; this is how far it sits raised in the composed frame
const DOOR_RAISED = -260;

export function DeckAct() {
	const ref = useRef<HTMLElement>(null);

	useAct(
		ref,
		({ isDesktop, q }) => {
			const intro = gsap.timeline({
				defaults: { ease: EASE.settle },
				delay: 0.1,
			});
			intro
				.from(q('[data-sky]'), { autoAlpha: 0, duration: DUR.epic }, 0)
				.from(
					q('[data-stars] circle'),
					{
						autoAlpha: 0,
						duration: DUR.slow,
						stagger: { each: 0.008, from: 'random' },
					},
					0.1,
				)
				.from(q('[data-horizon-line]'), { scaleX: 0, transformOrigin: '50% 50%', duration: DUR.epic }, 0.2)
				.from(q('[data-structure-intro]'), { y: 50, autoAlpha: 0, duration: DUR.epic }, 0.15)
				// anticipation: the door dips before the motors take its weight
				.fromTo(q('[data-door]'), { y: 0 }, { y: 8, duration: DUR.quick, ease: EASE.spool }, 0.45)
				.to(q('[data-door]'), { y: DOOR_RAISED, duration: 1.7, ease: EASE.glide })
				.from(
					q('[data-spill]'),
					{
						autoAlpha: 0,
						scaleY: 0.15,
						transformOrigin: '50% 0%',
						duration: 1.7,
						ease: EASE.glide,
					},
					'<',
				)
				.from(q('[data-blueprint] > *'), { autoAlpha: 0, duration: DUR.slow, stagger: STAGGER.loose }, 1.5)
				.from(q('[data-eyebrow]'), { autoAlpha: 0, y: 10, duration: DUR.slow }, 0.35)
				.from(q('[data-sub]'), { autoAlpha: 0, y: 18, duration: DUR.slow }, 1.05)
				.from(q('[data-ctas] > *'), { autoAlpha: 0, y: 18, duration: DUR.slow, stagger: STAGGER.base }, 1.2)
				.from(q('[data-cue]'), { autoAlpha: 0, duration: DUR.slow }, 1.9);

			SplitText.create(q('[data-headline]'), {
				type: 'lines',
				mask: 'lines',
				linesClass: 'split-line',
				autoSplit: true,
				onSplit: (self) =>
					gsap.from(self.lines, {
						yPercent: 115,
						duration: DUR.epic,
						ease: EASE.settle,
						stagger: STAGGER.base,
						delay: 0.45,
					}),
			});

			gsap.set(q('[data-intro]'), { visibility: 'visible' });
			releaseIntroGuard();

			gsap.to(q('[data-cue-line]'), {
				scaleY: 0.25,
				transformOrigin: '50% 100%',
				duration: DUR.slow * 1.5,
				ease: EASE.glide,
				repeat: -1,
				yoyo: true,
			});

			const tl = gsap.timeline({
				defaults: { ease: EASE.scrub },
				scrollTrigger: {
					trigger: ref.current,
					start: 'top top',
					end: pinLength('deck', isDesktop),
					pin: true,
					scrub: SCRUB,
				},
			});
			tl.to(q('[data-copy]'), { yPercent: -14, autoAlpha: 0, duration: 0.3, ease: EASE.glide }, 0)
				.to(q('[data-cue]'), { autoAlpha: 0, duration: 0.1 }, 0)
				.to(q('[data-door]'), { y: -420, duration: 0.55, ease: EASE.glide }, 0.05)
				.to(q('[data-structure]'), { scale: isDesktop ? 1.7 : 1.5, duration: 1, ease: EASE.throttle }, 0)
				.to(q('[data-blueprint]'), { scale: 2.1, autoAlpha: 0, duration: 0.7, ease: EASE.throttle }, 0)
				.to(q('[data-stars]'), { yPercent: -8, duration: 1 }, 0)
				.to(q('[data-sky]'), { yPercent: -3, duration: 1 }, 0)
				.to(q('[data-fade]'), { autoAlpha: 1, duration: 0.22, ease: EASE.glide }, 0.78);
		},
		{ eager: true },
	);

	return (
		<section
			ref={ref}
			id="deck"
			aria-labelledby="deck-title"
			className="relative h-svh min-h-[600px] overflow-hidden bg-night-950"
		>
			<div data-stars data-intro className="absolute inset-0">
				<StarField className="h-full w-full" />
			</div>

			<div className="story-stage hero-stage">
				<svg
					data-sky
					data-intro
					viewBox="0 0 1600 900"
					preserveAspectRatio="xMidYMax slice"
					className="absolute inset-0 h-full w-full"
					aria-hidden="true"
				>
					<defs>
						<linearGradient id="deck-sky" x1="0" x2="0" y1="0" y2="1">
							<stop offset="0" stopColor="#03050a" stopOpacity="0" />
							<stop offset="0.45" stopColor="#0a1222" />
							<stop offset="0.66" stopColor="#1d1a22" />
							<stop offset="0.711" stopColor="#5a3615" />
							<stop offset="0.712" stopColor="#04070d" />
						</linearGradient>
						<radialGradient id="deck-sun" cx="0.5" cy="0.5" r="0.5">
							<stop offset="0" stopColor="#ffb24a" stopOpacity="0.55" />
							<stop offset="1" stopColor="#ffb24a" stopOpacity="0" />
						</radialGradient>
					</defs>
					<rect width="1600" height="900" fill="url(#deck-sky)" />
					<ellipse cx="300" cy="640" rx="520" ry="110" fill="url(#deck-sun)" />
					<line data-horizon-line x1="0" y1="640" x2="1600" y2="640" stroke="rgb(255 178 74 / 0.4)" />
					<path d="M180,640 L188,628 L214,628 L218,620 L226,620 L230,628 L262,628 L268,640 Z" fill="#05080f" />
					<path d="M430,640 L436,632 L456,632 L459,626 L465,626 L468,632 L488,632 L492,640 Z" fill="#05080f" />
				</svg>

				<div data-structure className="absolute inset-0 origin-[70%_60%] will-change-transform">
					<svg
						data-structure-intro
						data-intro
						viewBox="0 0 1600 900"
						preserveAspectRatio="xMidYMax slice"
						className="absolute inset-0 h-full w-full"
						aria-hidden="true"
					>
						<defs>
							<radialGradient id="bay-light" cx="0.5" cy="0.85" r="0.75">
								<stop offset="0" stopColor="#ffe2b0" />
								<stop offset="0.35" stopColor="#ffb24a" />
								<stop offset="1" stopColor="#5a3008" />
							</radialGradient>
							<linearGradient id="bay-spill" x1="0" x2="0" y1="0" y2="1">
								<stop offset="0" stopColor="#ffb24a" stopOpacity="0.5" />
								<stop offset="1" stopColor="#ffb24a" stopOpacity="0" />
							</linearGradient>
							<clipPath id="bay-aperture">
								<rect x="760" y="300" width="720" height="400" />
							</clipPath>
						</defs>

						<path d="M600,700 L600,236 L640,196 L1600,196 L1600,700 Z" fill="#070b14" />
						<path d="M640,196 L640,700 M700,196 L700,700 M1530,196 L1530,700" stroke="#0c1424" strokeWidth="6" />
						<text x="672" y="420" fontFamily="var(--font-display)" fontWeight="800" fontSize="96" fill="#0d1527">
							02
						</text>

						<rect x="760" y="300" width="720" height="400" fill="url(#bay-light)" />
						<g clipPath="url(#bay-aperture)" stroke="rgb(90 48 8 / 0.5)" strokeWidth="3" fill="none">
							<path d="M760,340 L1480,340 M760,340 L860,300 M940,340 L1040,300 M1120,340 L1220,300 M1300,340 L1400,300" />
						</g>
						<JetSide tone="silhouette" x="840" y="530" width="580" height="174" />

						<g clipPath="url(#bay-aperture)">
							<g data-door transform={`translate(0 ${DOOR_RAISED})`}>
								<rect x="760" y="300" width="720" height="400" fill="#0b1220" />
								<path
									d="M760,320 H1480 M760,345 H1480 M760,370 H1480 M760,395 H1480 M760,420 H1480 M760,445 H1480 M760,470 H1480 M760,495 H1480 M760,520 H1480 M760,545 H1480 M760,570 H1480 M760,595 H1480 M760,620 H1480 M760,645 H1480 M760,670 H1480"
									stroke="#0f182b"
									strokeWidth="2"
								/>
								<rect x="760" y="692" width="720" height="8" fill="#1a2438" />
							</g>
						</g>

						<rect x="0" y="700" width="1600" height="200" fill="#04070d" />
						<g data-spill>
							<path d="M760,700 L1480,700 L1640,900 L560,900 Z" fill="url(#bay-spill)" />
						</g>
						<line x1="0" y1="742" x2="1600" y2="742" stroke="rgb(143 170 220 / 0.12)" />
						<line x1="0" y1="826" x2="1600" y2="826" stroke="rgb(255 178 74 / 0.35)" strokeDasharray="28 22" />
					</svg>
				</div>

				<svg
					data-blueprint
					viewBox="0 0 1600 900"
					preserveAspectRatio="xMidYMax slice"
					className="absolute inset-0 h-full w-full origin-[70%_60%]"
					aria-hidden="true"
				>
					<Dimension x1={760} x2={1480} y={272} label="BAY 02 · 72.0 M" />
					<g stroke="rgb(143 170 220 / 0.5)" fill="none">
						<path d="M744,316 V300 H760 M1496,316 V300 H1480 M744,684 V700 H760 M1496,684 V700 H1480" />
					</g>
					<g>
						<line x1="1300" y1="652" x2="1300" y2="772" stroke="rgb(255 178 74 / 0.7)" />
						<circle cx="1300" cy="652" r="3" fill="#ffb24a" />
						<text
							x="1310"
							y="776"
							fill="rgb(255 226 176 / 0.9)"
							fontSize="12"
							fontFamily="var(--font-code)"
							letterSpacing="2"
						>
							HGR-01 · READY
						</text>
					</g>
				</svg>
			</div>

			<div
				aria-hidden="true"
				className="absolute inset-y-0 left-0 z-10 hidden w-[55%] bg-gradient-to-r from-night-950/80 via-night-950/40 to-transparent md:block"
			/>

			<div
				data-copy
				className="relative z-20 mx-auto flex h-full max-w-[1440px] flex-col px-5 pt-24 md:justify-center md:px-10 md:pt-0"
			>
				<p data-intro data-eyebrow className="eyebrow">
					Self-hosted · HashiCorp stack
				</p>
				<h1
					id="deck-title"
					data-intro
					data-headline
					className="display mt-4 max-w-[11ch] text-[clamp(3rem,8.6vw,8.25rem)] text-steel-100 md:mt-6"
				>
					Your apps deserve a runway.
				</h1>
				<p
					data-intro
					data-sub
					className="mt-5 max-w-[30rem] text-base leading-relaxed text-steel-300 md:mt-7 md:text-lg"
				>
					Hangar is the self-hosted platform that launches everything on your homelab.
				</p>
				<div data-intro data-ctas className="mt-6 flex flex-wrap gap-3 md:mt-9">
					<Link to="/deployments/new" className={buttonVariants()}>
						Deploy your first app
						<HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
					</Link>
					<a href={DOCS_URL} className={buttonVariants({ variant: 'outline' })}>
						Read the docs
					</a>
				</div>
			</div>

			<div
				data-cue
				data-intro
				aria-hidden="true"
				className="absolute bottom-6 left-1/2 z-20 hidden -translate-x-1/2 flex-col items-center gap-3 md:flex"
			>
				<span className="font-code text-[10px] uppercase tracking-[0.3em] text-steel-400">Scroll is the throttle</span>
				<span data-cue-line className="block h-10 w-px bg-gradient-to-b from-deck-400 to-transparent" />
			</div>

			<div data-fade className="pointer-events-none absolute inset-0 z-30 bg-night-950 opacity-0" />
		</section>
	);
}
