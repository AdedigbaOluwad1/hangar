import { useRef } from 'react';
import { DUR, EASE, STAGGER, SplitText, actTimeline, gsap, useAct } from '../motion';
import { JetSide } from '../art/jet';
import { CrewFigure } from '../art/scenery';
import { LIVE_URL, LOG_LINES, SHORT_ID, type LogStage } from '../data';
import { ART } from '../art/palette';

const FIRE_AT = 0.5;

const HUD = [
	{ at: 0.1, text: 'nomad · job submitted' },
	{ at: 0.22, text: 'consul · waiting for a healthy alloc' },
	{ at: 0.34, text: 'consul · health check passing' },
	{ at: FIRE_AT, text: 'caddy · route patched' },
];

const STAGE_TONE: Record<LogStage, string> = {
	system: 'text-steel-500',
	build: 'text-deck-400',
	deploy: 'text-signal-400',
};

const SPEED_LINES = Array.from({ length: 14 }, (_, i) => ({
	top: 18 + ((i * 37) % 64),
	width: 18 + ((i * 53) % 30),
	thick: i % 3 === 0 ? 2 : 1,
}));

export function LaunchAct() {
	const ref = useRef<HTMLElement>(null);

	useAct(ref, ({ isDesktop, q }) => {
		const title = SplitText.create(q('[data-title]'), { type: 'words', mask: 'words' });
		const jet = q('[data-jet]');
		const flame = q('[data-jet] [data-part="flame"]');
		const thrust = { value: 0 };
		const thrustEl = q('[data-thrust]')[0];

		gsap.set(q('[data-jet-pose]'), { attr: { transform: '' } });
		gsap.set(jet, { transformOrigin: '50% 50%' });
		gsap.set(flame, { transformOrigin: '100% 50%' });
		q('[data-flame-layer]').forEach((layer, i) => {
			gsap.to(layer, {
				scaleX: `random(${0.86 + i * 0.03}, 1.06)`,
				scaleY: 'random(0.9, 1.1)',
				opacity: 'random(0.82, 1)',
				transformOrigin: '100% 50%',
				duration: DUR.impact,
				ease: EASE.impact,
				repeat: -1,
				repeatRefresh: true,
			});
		});
		gsap.to(q('[data-flame-diamonds] path'), {
			opacity: 'random(0.25, 0.95)',
			duration: DUR.impact,
			ease: EASE.impact,
			repeat: -1,
			repeatRefresh: true,
			stagger: { each: DUR.impact / 3, from: 'start' },
		});
		gsap.set(q('[data-terminal]'), { autoAlpha: 0, y: 40 });
		gsap.set(q('[data-log]'), { autoAlpha: 0, x: -8 });
		gsap.set(q('[data-pill-live]'), { autoAlpha: 0 });
		gsap.set(q('[data-pill-deploying]'), { autoAlpha: 1 });
		gsap.set(q('[data-url-live]'), { autoAlpha: 0 });
		gsap.set(q('[data-speed]'), { autoAlpha: 0, xPercent: 0 });
		gsap.set(q('[data-boom]'), { autoAlpha: 0, scale: 0.2, transformOrigin: '50% 50%' });

		const shot = gsap.timeline({ paused: true });
		shot
			.to(
				q('[data-shooter] [data-arm]'),
				{ rotation: -95, transformOrigin: '50% 0%', duration: DUR.instant, ease: EASE.snap },
				0,
			)
			.to(jet, { x: 380, duration: DUR.base, ease: EASE.throttle }, 0.06)
			.to(jet, { rotation: -34, duration: DUR.quick, ease: EASE.settle }, 0.46)
			.to(jet, { x: 1500, y: -980, scale: 0.7, duration: DUR.epic, ease: EASE.settle }, 0.5)
			.to(flame, { scaleX: 1.6, duration: DUR.quick, ease: EASE.settle }, 0.06)
			.fromTo(q('[data-flash]'), { autoAlpha: 0 }, { autoAlpha: 0.55, duration: DUR.impact, ease: EASE.impact }, 0.56)
			.to(q('[data-flash]'), { autoAlpha: 0, duration: DUR.base, ease: EASE.settle }, 0.62)
			.to(q('[data-boom]'), { autoAlpha: 1, duration: DUR.impact, ease: EASE.impact }, 0.56)
			.to(q('[data-boom]'), { scale: 4, autoAlpha: 0, duration: DUR.slow, ease: EASE.settle }, 0.58)
			.to(
				q('[data-shake]'),
				{
					keyframes: { x: [0, -12, 10, -8, 6, -3, 1, 0], y: [0, 6, -7, 5, -3, 2, -1, 0] },
					duration: DUR.base,
					ease: EASE.impact,
				},
				0.56,
			)
			.fromTo(
				q('[data-speed]'),
				{ autoAlpha: 0, xPercent: 120 },
				{
					autoAlpha: 1,
					xPercent: -260,
					duration: DUR.base,
					ease: EASE.throttle,
					stagger: { each: STAGGER.chars, from: 'random' },
				},
				0.26,
			)
			.to(q('[data-speed]'), { autoAlpha: 0, duration: DUR.quick }, 0.79)
			.to(
				q('[data-steam]'),
				{
					scale: 2.4,
					autoAlpha: 0,
					transformOrigin: '50% 100%',
					duration: DUR.epic,
					ease: EASE.settle,
					stagger: STAGGER.tight,
				},
				0.08,
			)
			.fromTo(q('[data-camera]'), { scale: 1.03 }, { scale: 1, duration: DUR.slow, ease: EASE.settle }, 0.56)
			.to(q('[data-hud]'), { autoAlpha: 0, duration: DUR.quick }, 0.84)
			.to(q('[data-terminal]'), { autoAlpha: 1, y: 0, duration: DUR.slow, ease: EASE.settle }, 1.19)
			.to(q('[data-log]'), { autoAlpha: 1, x: 0, duration: DUR.quick, ease: EASE.settle, stagger: STAGGER.loose }, 1.39)
			.to(q('[data-pill-deploying]'), { autoAlpha: 0, duration: DUR.quick }, 2.69)
			.fromTo(
				q('[data-pill-live]'),
				{ autoAlpha: 0, scale: 0.8 },
				{ autoAlpha: 1, scale: 1, duration: DUR.base, ease: EASE.snap },
				2.69,
			)
			.to(q('[data-url-live]'), { autoAlpha: 1, duration: DUR.base, ease: EASE.settle }, 2.69)
			.fromTo(
				q('[data-live-ring]'),
				{ scale: 1, autoAlpha: 0.9 },
				{ scale: 3, autoAlpha: 0, duration: DUR.slow, ease: EASE.settle },
				2.74,
			);

		let fired = false;
		const tl = actTimeline(ref.current, 'launch', isDesktop, (progress) => {
			if (progress >= FIRE_AT && !fired) {
				fired = true;
				shot.timeScale(1).play();
			} else if (progress < FIRE_AT - 0.04 && fired) {
				fired = false;
				shot.timeScale(3).reverse();
			}
		});

		tl.from(q('[data-eyebrow]'), { autoAlpha: 0, y: 12, duration: 0.05, ease: EASE.settle }, 0)
			.from(title.words, { yPercent: 110, duration: 0.08, ease: EASE.settle, stagger: 0.012 }, 0.01)
			.from(q('[data-lede]'), { autoAlpha: 0, y: 14, duration: 0.06, ease: EASE.settle }, 0.05)
			.from(q('[data-hud]'), { autoAlpha: 0, y: 10, duration: 0.05, ease: EASE.settle }, 0.06)
			.fromTo(q('[data-jet-taxi]'), { x: -1300 }, { x: 0, duration: 0.14, ease: EASE.brake }, 0)
			.fromTo(jet, { x: 0 }, { x: -10, duration: 0.2, ease: EASE.spool }, 0.2)
			.fromTo(flame, { scaleX: 0.05, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 1, duration: 0.3, ease: EASE.spool }, 0.15)
			.fromTo(
				q('[data-steam]'),
				{ scale: 0.2, autoAlpha: 0, transformOrigin: '50% 100%' },
				{ scale: 1, autoAlpha: 1, duration: 0.22, ease: EASE.settle, stagger: 0.02 },
				0.18,
			)
			.fromTo(
				q('[data-shooter] [data-arm]'),
				{ rotation: 0, transformOrigin: '50% 0%' },
				{ rotation: -170, duration: 0.05, ease: EASE.snap },
				0.4,
			)
			.to(
				thrust,
				{
					value: 100,
					duration: 0.42,
					ease: EASE.spool,
					onUpdate: () => {
						if (thrustEl) thrustEl.textContent = String(Math.round(thrust.value)).padStart(3, '0');
					},
				},
				0.06,
			)
			.to(q('[data-jet-body]'), { keyframes: { y: [0, -1, 1, -1.5, 1.5, -2, 2, -2.5, 2.5, 0] }, duration: 0.3 }, 0.2)
			.fromTo(q('[data-far]'), { xPercent: 0 }, { xPercent: -4, duration: 1 }, 0);

		q('[data-hud-line]').forEach((line, i) => {
			tl.fromTo(line, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.03, ease: EASE.settle }, HUD[i].at);
			if (HUD[i + 1]) tl.to(line, { autoAlpha: 0, y: -6, duration: 0.03 }, HUD[i + 1].at - 0.02);
		});

		tl.to({}, { duration: 0.01 }, 0.99);

		return () => {
			shot.kill();
			title.revert();
		};
	});

	return (
		<section
			ref={ref}
			id="launch"
			aria-labelledby="launch-title"
			className="relative min-h-svh overflow-hidden bg-night-950"
		>
			<div data-camera className="absolute inset-0 will-change-transform">
				<div data-shake className="absolute inset-0">
					<div
						aria-hidden="true"
						className="absolute inset-0"
						style={{ backgroundImage: `linear-gradient(to bottom, ${ART.night}, ${ART.skyLow}, ${ART.duskLow})` }}
					/>
					<div aria-hidden="true" className="story-stage launch-stage">
						<div data-far className="absolute inset-y-0 left-0 w-[110%] will-change-transform">
							<svg viewBox="0 0 1760 900" preserveAspectRatio="xMinYMax meet" className="h-full w-full">
								<defs>
									<radialGradient id="launch-sun" cx="0.5" cy="0.5" r="0.5">
										<stop offset="0" stopColor={ART.amberSoft} stopOpacity="0.7" />
										<stop offset="0.4" stopColor={ART.amber} stopOpacity="0.25" />
										<stop offset="1" stopColor={ART.amber} stopOpacity="0" />
									</radialGradient>
								</defs>
								<ellipse cx="1350" cy="640" rx="620" ry="160" fill="url(#launch-sun)" />
								<rect x="0" y="640" width="1760" height="260" fill={ART.sea} />
								<line x1="0" y1="640" x2="1760" y2="640" stroke="rgb(255 211 145 / 0.55)" />
								<path
									d="M1500,640 L1508,630 L1534,630 L1538,622 L1546,622 L1550,630 L1582,630 L1588,640 Z"
									fill={ART.hull}
								/>
							</svg>
						</div>

						<svg viewBox="0 0 1600 900" className="absolute inset-0 h-full w-full overflow-visible">
							<defs>
								<radialGradient id="steam" cx="0.5" cy="0.5" r="0.5">
									<stop offset="0" stopColor={ART.steel} stopOpacity="0.55" />
									<stop offset="1" stopColor={ART.steel} stopOpacity="0" />
								</radialGradient>
							</defs>
							<path d="M-60,700 L1270,700 L1330,712 L1290,770 L1150,900 L-60,900 Z" fill={ART.hull} />
							<rect x="-60" y="700" width="1330" height="9" fill={ART.deckEdge} />
							<line
								x1="220"
								y1="699"
								x2="1260"
								y2="699"
								stroke={ART.signal}
								strokeOpacity="0.55"
								strokeWidth="2"
								strokeDasharray="22 10"
							/>
							{[380, 520, 680, 840, 1000, 1160].map((x, i) => (
								<ellipse key={x} data-steam cx={x} cy={688 - (i % 2) * 6} rx="90" ry="26" fill="url(#steam)" />
							))}
							<CrewFigure data-shooter jersey={ART.amber} transform="translate(1140 700) scale(1.7)" />
							<circle
								data-boom
								cx="1290"
								cy="640"
								r="60"
								fill="none"
								stroke={ART.amberSoft}
								strokeWidth="3"
								opacity="0"
							/>
							<g data-jet-pose transform="translate(760 -330) rotate(-34 600 640) scale(0.85)">
								<g data-jet-taxi>
									<g data-jet>
										<g data-jet-body>
											<JetSide tone="steel" flame x="380" y="572" width="440" height="132" />
										</g>
									</g>
								</g>
							</g>
						</svg>
					</div>

					<div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
						{SPEED_LINES.map((l, i) => (
							<span
								key={i}
								data-speed
								className="absolute right-0 rounded-full bg-gradient-to-l from-transparent via-steel-100/70 to-transparent"
								style={{ top: `${l.top}%`, width: `${l.width}vw`, height: l.thick, opacity: 0 }}
							/>
						))}
					</div>
				</div>
			</div>

			<div
				data-flash
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 z-30"
				style={{ opacity: 0, background: ART.flash }}
			/>

			<div className="relative z-10 mx-auto max-w-[1440px] px-5 pt-20 md:px-10 md:pt-28">
				<p data-eyebrow className="eyebrow">
					Act IV · Launch
				</p>
				<h2 id="launch-title" data-title className="display mt-3 max-w-[12ch] text-display-act md:mt-5">
					Zero to airborne.
				</h2>
				<p data-lede className="mt-3 max-w-sm text-sm leading-relaxed text-steel-300 md:mt-5 md:text-base">
					Nomad schedules it. Consul waits for a passing health check. Caddy opens the route.
				</p>

				<div
					data-hud
					aria-hidden="true"
					className="mt-6 inline-flex flex-col gap-1 rounded-md md:flex-row md:items-center md:gap-4 border border-line bg-night-900/90 px-3 py-2 font-code text-mono text-steel-300 md:mt-8 md:text-xs"
				>
					<span className="text-steel-500">
						CAT 1 · THRUST{' '}
						<span data-thrust className="text-deck-300">
							100
						</span>
						%
					</span>
					<span className="relative block h-4 w-56 md:w-64">
						{HUD.map((h, i) => (
							<span
								key={h.text}
								data-hud-line
								className="absolute inset-0 truncate"
								style={i < HUD.length - 1 ? { visibility: 'hidden' } : undefined}
							>
								› {h.text}
							</span>
						))}
					</span>
				</div>
			</div>

			<div className="pointer-events-none absolute inset-x-4 bottom-6 z-20 md:inset-x-0 md:bottom-auto md:top-28">
				<div className="mx-auto flex max-w-[1440px] justify-end md:px-10">
					<div
						data-terminal
						className="pointer-events-auto w-full rounded-xl border border-line bg-night-900/95 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.8)] md:w-[min(760px,56%)]"
					>
						<div className="flex items-center justify-between border-b border-line px-4 py-3">
							<p className="font-code text-mono text-steel-400 md:text-xs">
								hangar · deployment <span className="text-steel-100">{SHORT_ID}</span>
							</p>
							<span className="relative grid">
								<span
									data-pill-deploying
									className="col-start-1 row-start-1 inline-flex items-center gap-1.5 rounded-full border border-deck-400/40 px-2 py-0.5 font-code text-micro uppercase tracking-wider text-deck-300"
									style={{ visibility: 'hidden' }}
								>
									<span className="h-1.5 w-1.5 rounded-full bg-deck-400" />
									Deploying
								</span>
								<span
									data-pill-live
									className="col-start-1 row-start-1 inline-flex items-center gap-1.5 rounded-full border border-signal-400/40 px-2 py-0.5 font-code text-micro uppercase tracking-wider text-signal-400"
								>
									<span className="relative h-1.5 w-1.5 rounded-full bg-signal-400">
										<span data-live-ring className="absolute inset-0 rounded-full bg-signal-400 opacity-0" />
									</span>
									Running
								</span>
							</span>
						</div>

						<div className="px-4 pt-4">
							<div className="relative font-code text-mono md:text-sm">
								<p className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-steel-400">
									<span className="h-2 w-2 shrink-0 rounded-full bg-steel-500" aria-hidden="true" />
									<span className="truncate">{LIVE_URL}</span>
								</p>
								<p
									data-url-live
									className="absolute inset-0 flex items-center gap-2 rounded-md border border-signal-400/45 bg-signal-950 px-3 py-2 text-signal-400"
								>
									<span className="live-dot shrink-0" aria-hidden="true" />
									<span className="truncate">{LIVE_URL}</span>
								</p>
							</div>
						</div>

						<ol
							className="space-y-1 px-4 py-4 font-code text-mono leading-relaxed md:space-y-1.5 md:px-5 md:py-5 md:text-sm"
							aria-label="Deployment log"
						>
							{LOG_LINES.map((l, i) => (
								<li key={i} data-log className="flex gap-3 whitespace-nowrap">
									<span className={`w-12 shrink-0 ${STAGE_TONE[l.stage]}`}>{l.stage}</span>
									<span className="truncate text-steel-300">{l.text}</span>
								</li>
							))}
						</ol>
						<p className="border-t border-line px-4 py-2.5 font-code text-micro text-steel-500">
							Streamed over SSE from Redis pub/sub
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
