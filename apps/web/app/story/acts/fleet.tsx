// apps/web/app/story/acts/fleet.tsx
//
// Act 6: pull back to the whole carrier group. The carrier is what ships
// today; the dashed escorts are the multi-node roadmap. Then the final call.
import { useRef } from 'react';
import { Link } from 'react-router';
import { HugeiconsIcon } from '@hugeicons/react';
import { buttonVariants } from '../../components/ui/button';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { DUR, EASE, SCRUB, STAGGER, SplitText, gsap, pinLength, useAct } from '../motion';
import { GITHUB_URL } from '../nav';
import { Mark } from '../../components/mark';

const ROADMAP = [
	{ title: 'One machine', body: 'Local, or remote over SSH. One ./deploy.sh on Ubuntu 24.', coming: false },
	{ title: 'Multi-node', body: '3 servers, N workers. The carrier becomes a fleet.', coming: true },
	{ title: 'GitHub OAuth', body: 'Sign in with GitHub.', coming: true },
	{ title: 'Custom domains', body: 'Your own hostnames in front of every app.', coming: true },
];

// plan view, bow to the right
const CARRIER = 'M8,62 L36,34 L300,30 L338,22 L372,26 L396,60 L372,94 L300,96 L36,92 Z';
const ESCORT = 'M4,15 L22,4 L96,4 L118,15 L96,26 L22,26 Z';

// escorts: [x, y, scale, role] in the 1600x900 scene
const ESCORTS: Array<[number, number, number, string]> = [
	[300, 650, 1.6, 'server'],
	[860, 200, 1.6, 'server'],
	[1250, 260, 1, 'worker'],
	[1240, 700, 1, 'worker'],
	[1400, 480, 1, 'worker'],
];

export function FleetAct() {
	const ref = useRef<HTMLElement>(null);

	useAct(ref, ({ isDesktop, q }) => {
		const title = SplitText.create(q('[data-title]'), { type: 'words', mask: 'words' });

		const tl = gsap.timeline({
			defaults: { ease: EASE.scrub },
			scrollTrigger: {
				trigger: ref.current,
				start: 'top top',
				end: pinLength('fleet', isDesktop),
				pin: true,
				scrub: SCRUB,
			},
		});

		tl.fromTo(
			q('[data-group]'),
			{ scale: 2.6, transformOrigin: '50% 50%' },
			{ scale: 1, duration: 0.6, ease: EASE.glide },
			0,
		)
			.fromTo(q('[data-sea]'), { scale: 1.3 }, { scale: 1, duration: 0.6, ease: EASE.glide }, 0)
			.from(
				q('[data-wake]'),
				{ scaleX: 0, transformOrigin: '100% 50%', duration: 0.5, ease: EASE.settle, stagger: 0.03 },
				0.05,
			)
			.from(
				q('[data-escort]'),
				{ autoAlpha: 0, scale: 0.6, transformOrigin: '50% 50%', duration: 0.12, ease: EASE.snap, stagger: 0.04 },
				0.35,
			)
			.from(q('[data-eyebrow]'), { autoAlpha: 0, y: 12, duration: 0.06, ease: EASE.settle }, 0.15)
			.from(title.words, { yPercent: 110, duration: 0.12, ease: EASE.settle, stagger: 0.02 }, 0.16)
			.from(q('[data-road]'), { autoAlpha: 0, y: 18, duration: 0.1, ease: EASE.settle, stagger: 0.05 }, 0.45)
			.fromTo(q('[data-ships]'), { xPercent: 0 }, { xPercent: 2, duration: 1 }, 0)
			.to({}, { duration: 0.01 }, 0.99);

		return () => title.revert();
	});

	return (
		<section
			ref={ref}
			id="fleet"
			aria-labelledby="fleet-title"
			className="relative min-h-svh overflow-hidden bg-night-950"
		>
			<div data-sea aria-hidden="true" className="ocean absolute inset-0" />

			<div aria-hidden="true" className="story-stage fleet-stage">
				<svg data-group viewBox="0 0 1600 900" className="absolute inset-0 h-full w-full overflow-visible">
					<g data-ships>
						{/* wakes trail to the left of each hull */}
						<g stroke="rgb(232 236 243 / 0.12)" fill="none" strokeWidth="2">
							<path data-wake d="M612,452 L300,400 M612,472 L300,524" />
							{ESCORTS.map(([x, y, s], i) => (
								<path
									key={i}
									data-wake
									d={`M${x},${y + 15 * s} L${x - 150 * s},${y - 2 * s} M${x},${y + 15 * s} L${x - 150 * s},${y + 32 * s}`}
								/>
							))}
						</g>

						<g transform="translate(600 400)">
							<path d={CARRIER} fill="#1d2a44" stroke="rgb(143 170 220 / 0.45)" />
							<path d="M60,40 L330,74" stroke="rgb(255 178 74 / 0.5)" strokeDasharray="12 8" />
							<path d="M50,62 H360" stroke="rgb(143 170 220 / 0.25)" strokeDasharray="6 8" />
							<rect x="250" y="80" width="40" height="12" fill="#0b1220" />
							<text
								x="20"
								y="-14"
								fill="rgb(255 210 150 / 0.9)"
								fontSize="13"
								fontFamily="var(--font-code)"
								letterSpacing="2.5"
							>
								HANGAR-01 · TODAY
							</text>
						</g>

						{ESCORTS.map(([x, y, s, role], i) => (
							<g key={i} data-escort transform={`translate(${x} ${y}) scale(${s})`}>
								<path
									d={ESCORT}
									fill="rgb(29 42 68 / 0.25)"
									stroke="rgb(143 170 220 / 0.6)"
									strokeDasharray="5 4"
									vectorEffect="non-scaling-stroke"
								/>
								<text
									x="0"
									y="-8"
									fill="rgb(143 170 220 / 0.75)"
									fontSize={11 / s}
									fontFamily="var(--font-code)"
									letterSpacing={2 / s}
								>
									{`${role.toUpperCase()} · COMING`}
								</text>
							</g>
						))}
					</g>
				</svg>
			</div>

			<div className="relative z-10 mx-auto flex min-h-svh max-w-[1440px] flex-col justify-between px-5 pb-8 pt-20 md:px-10 md:pb-12 md:pt-28">
				<div>
					<p data-eyebrow className="eyebrow">
						Act VI · The Fleet
					</p>
					<h2
						id="fleet-title"
						data-title
						className="display mt-3 max-w-[13ch] text-[clamp(2.5rem,6vw,5.75rem)] md:mt-5"
					>
						Starts on one machine. Built for a fleet.
					</h2>
				</div>

				<ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4 md:gap-8">
					{ROADMAP.map((r) => (
						<li key={r.title} data-road className="border-t border-line pt-3">
							<p className="flex flex-wrap items-center gap-2">
								<span className="font-display text-lg font-bold uppercase tracking-wide md:text-xl">{r.title}</span>
								{r.coming ? <span className="chip chip-coming">Coming</span> : <span className="chip">Today</span>}
							</p>
							<p className="mt-1 text-xs leading-snug text-steel-400 md:text-sm">{r.body}</p>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}

export function Coda() {
	const ref = useRef<HTMLElement>(null);

	useAct(ref, ({ q }) => {
		const title = SplitText.create(q('[data-title]'), { type: 'chars', mask: 'chars' });
		gsap
			.timeline({ scrollTrigger: { trigger: ref.current, start: 'top 70%', toggleActions: 'play none none reverse' } })
			.from(title.chars, { yPercent: 110, duration: DUR.slow, ease: EASE.settle, stagger: STAGGER.chars })
			.from(
				q('[data-cta] > *'),
				{ autoAlpha: 0, y: 16, duration: DUR.base, ease: EASE.settle, stagger: STAGGER.base },
				'-=0.4',
			)
			.from(
				q('[data-runway] span'),
				{ scaleX: 0, transformOrigin: '0% 50%', duration: DUR.slow, ease: EASE.throttle, stagger: 0.03 },
				0,
			);
		return () => title.revert();
	});

	return (
		<section ref={ref} aria-labelledby="coda-title" className="relative overflow-hidden bg-night-950">
			<div
				className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-deck-500/10 to-transparent"
				aria-hidden="true"
			/>
			<div className="relative mx-auto max-w-[1440px] px-5 pb-16 pt-28 md:px-10 md:pb-24 md:pt-40">
				<div data-runway aria-hidden="true" className="mb-10 flex gap-3 md:mb-14">
					{Array.from({ length: 12 }, (_, i) => (
						<span key={i} className="block h-1 flex-1 rounded-full bg-deck-400" style={{ opacity: 0.15 + i * 0.07 }} />
					))}
				</div>
				<h2 id="coda-title" data-title className="display text-[clamp(3.25rem,11vw,10rem)]">
					Clear for takeoff.
				</h2>
				<div data-cta className="mt-8 flex flex-wrap gap-3 md:mt-12">
					<Link to="/deployments/new" className={buttonVariants()}>
						Deploy your first app
						<HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
					</Link>
					<a href={GITHUB_URL} className={buttonVariants({ variant: 'outline' })}>
						View on GitHub
					</a>
				</div>
			</div>

			<footer className="relative border-t border-line">
				<div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-8 text-sm text-steel-400 md:flex-row md:items-center md:justify-between md:px-10">
					<p className="flex items-center gap-2.5">
						<Mark className="h-5 w-5" />
						Hangar · a self-hosted platform on the HashiCorp stack
					</p>
					<nav aria-label="Footer" className="flex gap-6">
						<Link to="/dashboard" className="hover:text-steel-100">
							Dashboard
						</Link>
						<a href={`${GITHUB_URL}#readme`} className="hover:text-steel-100">
							Docs
						</a>
						<a href={GITHUB_URL} className="hover:text-steel-100">
							GitHub
						</a>
					</nav>
				</div>
			</footer>
		</section>
	);
}
