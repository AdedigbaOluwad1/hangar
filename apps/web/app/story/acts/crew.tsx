import { useRef } from 'react';
import { EASE, SplitText, actTimeline, entrySpeed, exitSpeed, gsap, taxiHandoff, useAct, visibleSpan } from '../motion';
import { JetSide } from '../art/jet';
import { CrewFigure, StarField } from '../art/scenery';
import { ART } from '../art/palette';

const ROLES = [
	{
		tool: 'Nomad',
		role: 'Flight Director',
		body: 'Schedules every job onto the deck.',
		jersey: ART.amber,
	},
	{
		tool: 'Consul',
		role: 'Air Traffic Control',
		body: 'Service discovery. Every app findable by name.',
		jersey: ART.steel,
	},
	{
		tool: 'Vault',
		role: 'The Armory',
		body: 'Secrets issued per workload. No static tokens.',
		jersey: ART.alarmDeep,
	},
	{
		tool: 'Caddy',
		role: 'The Catapult',
		body: 'Routes live traffic the instant the app is airborne.',
		jersey: ART.signal,
	},
];

const CREDITS = [
	{ tool: 'Podman', body: 'Runs every container. No daemon.' },
	{ tool: 'BullMQ', body: 'The launch queue. One build at a time.' },
];

const DECK_WIDTH = 4800;
const DECK_TRAVEL = DECK_WIDTH - 1600;
const JET_X = 600;
const STATION_X = [1000, 1800, 2600, 3400];
const JET_REST = 90;
const JET_TAIL = JET_X - 286;
const CLEARANCE = 24;
const CREW_END = 0.99;

function solve(f: (t: number) => number, target: number) {
	let lo = 0;
	let hi = 1;
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		if (f(mid) < target) lo = mid;
		else hi = mid;
	}
	return lo;
}

export function CrewAct() {
	const ref = useRef<HTMLElement>(null);

	useAct(ref, ({ isDesktop, q }) => {
		const title = SplitText.create(q('[data-title]'), { type: 'words', mask: 'words' });
		const roles = q('[data-role]');

		if (!isDesktop) gsap.set(roles.slice(1), { position: 'absolute', inset: 0 });

		const jetGone = visibleSpan(q('.crew-stage')[0]).right - JET_TAIL + CLEARANCE;
		const exitDur = (exitSpeed(EASE.catapult) * (jetGone - JET_REST)) / taxiHandoff('crew', isDesktop);
		const pullAt = CREW_END - exitDur;
		const coastSpan = exitDur / entrySpeed(EASE.coast);
		const panSpeed = DECK_TRAVEL / (pullAt + coastSpan);
		const cruiseShare = pullAt / (pullAt + coastSpan);
		const travelled = (t: number) => {
			if (t <= pullAt) return panSpeed * t;
			const k = Math.min(1, (t - pullAt) / exitDur);
			return panSpeed * (pullAt + coastSpan * (2 * k - k * k)) + (jetGone - JET_REST) * k * k;
		};
		const passAt = (x: number) => solve(travelled, x - JET_X);

		const tl = actTimeline(ref.current, 'crew', isDesktop);

		tl.from(q('[data-eyebrow]'), { autoAlpha: 0, y: 12, duration: 0.04, ease: EASE.settle }, 0)
			.from(title.words, { yPercent: 110, duration: 0.07, ease: EASE.settle, stagger: 0.01 }, 0.01)
			.fromTo(q('[data-jet]'), { x: -60 }, { x: JET_REST, duration: pullAt, ease: EASE.glide }, 0)
			.to(q('[data-jet]'), { x: jetGone, duration: exitDur, ease: EASE.catapult }, pullAt)
			.fromTo(q('[data-jet-body]'), { y: 0 }, { y: -2, duration: 0.05, repeat: 16, yoyo: true }, 0);

		const pan: Array<[string, number]> = [
			['[data-deck]', -(DECK_TRAVEL / DECK_WIDTH) * 100],
			['[data-ruler]', -45],
			['[data-far]', -12],
			['[data-stars]', -3],
		];
		pan.forEach(([layer, xPercent]) => {
			tl.fromTo(q(layer), { xPercent: 0 }, { xPercent: xPercent * cruiseShare, duration: pullAt }, 0).to(
				q(layer),
				{ xPercent, duration: exitDur, ease: EASE.coast },
				pullAt,
			);
		});

		STATION_X.forEach((x, i) => {
			const at = passAt(x);
			const station = q(`[data-station="${i}"]`)[0];
			tl.to(
				station.querySelector('[data-arm]'),
				{ rotation: 20, transformOrigin: '50% 0%', duration: 0.02, ease: EASE.spool },
				at - 0.05,
			)
				.to(station.querySelector('[data-arm]'), { rotation: -150, duration: 0.04, ease: EASE.snap }, at - 0.03)
				.fromTo(
					station.querySelector('[data-lamp]'),
					{ opacity: 0.2, scale: 0.6, transformOrigin: '50% 50%' },
					{ opacity: 1, scale: 1, duration: 0.03, ease: EASE.snap },
					at - 0.03,
				)
				.fromTo(
					station.querySelector('[data-beam]'),
					{ opacity: 0 },
					{ opacity: 1, duration: 0.04, ease: EASE.settle },
					at - 0.03,
				);

			const card = roles[i];
			const next = STATION_X[i + 1] ? passAt(STATION_X[i + 1]) : null;
			if (isDesktop) {
				tl.fromTo(card, { opacity: 0.32 }, { opacity: 1, duration: 0.04, ease: EASE.settle }, at - 0.06).fromTo(
					card.querySelector('[data-role-bar]'),
					{ scaleX: 0 },
					{ scaleX: 1, duration: 0.06, ease: EASE.settle },
					at - 0.06,
				);
			} else {
				tl.fromTo(card, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.05, ease: EASE.settle }, at - 0.08);
				if (next !== null) tl.to(card, { autoAlpha: 0, y: -24, duration: 0.04, ease: EASE.glide }, next - 0.1);
			}
		});

		tl.from(q('[data-credit]'), { autoAlpha: 0, y: 16, duration: 0.05, ease: EASE.settle, stagger: 0.03 }, 0.9);

		return () => title.revert();
	});

	return (
		<section
			ref={ref}
			id="crew"
			aria-labelledby="crew-title"
			className="relative min-h-svh overflow-hidden bg-night-950"
		>
			<div
				aria-hidden="true"
				className="absolute inset-0"
				style={{
					backgroundImage: `linear-gradient(to bottom, ${ART.night}, var(--color-night-900), ${ART.duskFloor})`,
				}}
			/>
			<div data-stars aria-hidden="true" className="absolute inset-0 w-[110%] opacity-70">
				<StarField className="h-full w-full" />
			</div>

			<div aria-hidden="true" className="story-stage crew-stage">
				<div data-far className="absolute inset-y-0 left-0 w-[130%] will-change-transform">
					<svg viewBox="0 0 2080 900" preserveAspectRatio="xMinYMax meet" className="absolute inset-0 h-full w-full">
						<defs>
							<radialGradient id="crew-dusk" cx="0.5" cy="0.5" r="0.5">
								<stop offset="0" stopColor={ART.amber} stopOpacity="0.35" />
								<stop offset="1" stopColor={ART.amber} stopOpacity="0" />
							</radialGradient>
						</defs>
						<ellipse cx="1500" cy="640" rx="700" ry="90" fill="url(#crew-dusk)" />
						<line x1="0" y1="640" x2="2080" y2="640" stroke="rgb(255 178 74 / 0.3)" />
						<path d="M520,640 L528,628 L554,628 L558,620 L566,620 L570,628 L602,628 L608,640 Z" fill={ART.hull} />
						<path
							d="M1640,640 L1646,632 L1666,632 L1669,626 L1675,626 L1678,632 L1698,632 L1702,640 Z"
							fill={ART.hull}
						/>
					</svg>
				</div>

				<div data-deck className="absolute inset-y-0 left-0 w-[300%] will-change-transform">
					<svg viewBox={`0 0 ${DECK_WIDTH} 900`} className="absolute inset-0 h-full w-full">
						<defs>
							<linearGradient id="crew-beam" x1="0" x2="0" y1="0" y2="1">
								<stop offset="0" stopColor={ART.amber} stopOpacity="0" />
								<stop offset="1" stopColor={ART.amber} stopOpacity="0.28" />
							</linearGradient>
						</defs>
						<path
							d="M120,700 L120,470 L170,470 L170,380 L210,380 L210,330 L222,330 L222,380 L300,380 L300,470 L560,470 L600,700 Z"
							fill={ART.wall}
						/>
						<path
							d="M190,420 H280 M190,440 H280"
							stroke="rgb(255 178 74 / 0.4)"
							strokeWidth="3"
							strokeDasharray="6 10"
						/>
						<rect x="0" y="700" width={DECK_WIDTH} height="200" fill={ART.hull} />
						<rect x="0" y="700" width={DECK_WIDTH} height="10" fill={ART.deckEdge} />
						<g fill={ART.amber} opacity="0.5">
							{Array.from({ length: 40 }, (_, i) => (
								<circle key={i} cx={60 + i * 120} cy="716" r="2.2" />
							))}
						</g>
						<line
							x1="3700"
							y1="699"
							x2="4700"
							y2="699"
							stroke={ART.signal}
							strokeOpacity="0.5"
							strokeWidth="2"
							strokeDasharray="22 10"
						/>
						{STATION_X.map((x, i) => (
							<g key={x} data-station={i}>
								<path
									data-beam
									d={`M${x - 70},700 L${x - 14},560 L${x + 14},560 L${x + 70},700 Z`}
									fill="url(#crew-beam)"
								/>
								<rect x={x - 2} y="560" width="4" height="140" fill={ART.post} />
								<circle data-lamp cx={x} cy="556" r="9" fill={ROLES[i].jersey} />
								<CrewFigure jersey={ROLES[i].jersey} transform={`translate(${x + 54} 700) scale(1.7)`} />
								<text
									x={x}
									y="770"
									textAnchor="middle"
									fill="rgb(143 170 220 / 0.55)"
									fontSize="15"
									fontFamily="var(--font-code)"
									letterSpacing="3"
								>
									{`0${i + 1} · ${ROLES[i].tool.toUpperCase()}`}
								</text>
							</g>
						))}
					</svg>
				</div>

				<svg viewBox="0 0 1600 900" className="absolute inset-0 h-full w-full overflow-visible">
					<g data-jet>
						<g data-jet-body>
							<JetSide tone="steel" x={JET_X - 290} y="572" width="460" height="138" />
						</g>
					</g>
				</svg>

				<div data-ruler className="absolute bottom-[6%] left-0 h-6 w-[200%]">
					<svg viewBox="0 0 3200 24" preserveAspectRatio="none" className="h-full w-full">
						{Array.from({ length: 81 }, (_, i) => (
							<line key={i} x1={i * 40} x2={i * 40} y1={i % 5 ? 16 : 6} y2="24" stroke="rgb(143 170 220 / 0.35)" />
						))}
					</svg>
				</div>
			</div>

			<div className="relative z-10 mx-auto max-w-[1440px] px-5 pb-[50svh] pt-20 md:px-10 md:pb-[46svh] md:pt-28">
				<p data-eyebrow className="eyebrow">
					Act III · The Crew
				</p>
				<h2 id="crew-title" data-title className="display mt-3 max-w-[14ch] text-display-act md:mt-5">
					Every launch has a crew.
				</h2>

				<ul className="relative mt-6 grid gap-3 md:mt-10 md:grid-cols-4 md:gap-5">
					{ROLES.map((r) => (
						<li key={r.tool} data-role className="relative rounded-lg border border-line bg-night-900/90 p-4 md:p-5">
							<span
								data-role-bar
								aria-hidden="true"
								className="absolute inset-x-0 top-0 h-0.5 origin-left rounded-t-lg"
								style={{ background: r.jersey }}
							/>
							<p className="font-code text-mono uppercase tracking-[0.18em] text-steel-400">{r.role}</p>
							<h3 className="mt-1.5 font-display text-2xl font-bold uppercase tracking-wide md:text-3xl">{r.tool}</h3>
							<p className="mt-1.5 text-sm leading-snug text-steel-300">{r.body}</p>
						</li>
					))}
				</ul>
			</div>

			<ul className="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-[1440px] flex-wrap gap-x-8 gap-y-1 px-5 pb-5 md:px-10 md:pb-8">
				{CREDITS.map((c) => (
					<li key={c.tool} data-credit className="text-xs text-steel-400 md:text-sm">
						<span className="font-semibold text-steel-100">{c.tool}</span> · {c.body}
					</li>
				))}
			</ul>
		</section>
	);
}
