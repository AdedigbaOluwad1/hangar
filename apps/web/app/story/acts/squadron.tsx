import { useRef } from 'react';
import { DUR, EASE, MotionPathPlugin, SplitText, actTimeline, entrySpeed, exitSpeed, gsap, useAct } from '../motion';
import { JetPlan } from '../art/jet';
import { TAG_HISTORY } from '../data';
import { ART } from '../art/palette';

type Status = 'running' | 'building' | 'deploying';

const STATUS_DOT: Record<Status, string> = {
	running: 'bg-signal-400',
	building: 'bg-deck-400',
	deploying: 'bg-steel-300',
};

const SQUADRON: Array<{ name: string; x: number; y: number; status: Status }> = [
	{ name: 'portfolio', x: 50, y: 14, status: 'running' },
	{ name: 'grafana', x: 38, y: 27, status: 'running' },
	{ name: 'n8n', x: 62, y: 27, status: 'running' },
	{ name: 'blog', x: 26, y: 40, status: 'building' },
	{ name: 'notes-api', x: 74, y: 40, status: 'running' },
	{ name: 'pastebin', x: 14, y: 52, status: 'running' },
	{ name: 'status', x: 86, y: 46, status: 'deploying' },
];
const ROLLBACK = SQUADRON.findIndex((j) => j.name === 'notes-api');
const TRAP = { x: 40, y: 86 };
const WIRE_X = 54.2;

const VIEW = { w: 400, h: 300 };
const JET_W = VIEW.w * 0.09;
const JET_H = JET_W * 1.4;
const toView = (p: { x: number; y: number }) => ({ x: (p.x / 100) * VIEW.w, y: (p.y / 100) * VIEW.h });
const HOME = toView(SQUADRON[ROLLBACK]);
const STOP = toView(TRAP);
const WIRE = (WIRE_X / 100) * VIEW.w;
const TURN_RADIUS = JET_H;
const CORRIDOR_X = HOME.x + 2 * TURN_RADIUS;
const CREST = { x: HOME.x + TURN_RADIUS, y: HOME.y - TURN_RADIUS };
const FINAL = { x: CORRIDOR_X - TURN_RADIUS, y: STOP.y };

const BREAK = `M${HOME.x},${HOME.y} A${TURN_RADIUS},${TURN_RADIUS} 0 0 1 ${CREST.x},${CREST.y}`;
const PATTERN = [
	`M${CREST.x},${CREST.y}`,
	`A${TURN_RADIUS},${TURN_RADIUS} 0 0 1 ${CORRIDOR_X},${HOME.y}`,
	`L${CORRIDOR_X},${STOP.y - TURN_RADIUS}`,
	`A${TURN_RADIUS},${TURN_RADIUS} 0 0 1 ${FINAL.x},${FINAL.y}`,
	`L${WIRE},${STOP.y}`,
].join(' ');
const ROLLOUT = `M${WIRE},${STOP.y} L${STOP.x},${STOP.y}`;

const OPS = [
	{ verb: 'Redeploy', body: 'Fresh clone, rebuilt on cached layers.' },
	{ verb: 'Rollback', body: 'Any of the last three images, straight back on deck. No rebuild.' },
	{ verb: 'Resize', body: 'CPU and memory per deployment.' },
];

export function SquadronAct() {
	const ref = useRef<HTMLElement>(null);

	useAct(ref, ({ isDesktop, q }) => {
		const title = SplitText.create(q('[data-title]'), { type: 'words', mask: 'words' });
		const lead = SQUADRON[0];
		const box = q('[data-formation]')[0] as HTMLElement;
		const backJet = q('[data-back-jet]');

		const flightAt = 0.38;
		const stopAt = 0.86;
		const breakLength = MotionPathPlugin.getLength(BREAK);
		const patternLength = MotionPathPlugin.getLength(PATTERN);
		const rolloutLength = MotionPathPlugin.getLength(ROLLOUT);
		const breakSpan = exitSpeed(EASE.catapult) * breakLength;
		const rolloutSpan = entrySpeed(EASE.coast) * rolloutLength;
		const speed = (breakSpan + patternLength + rolloutSpan) / (stopAt - flightAt);
		const breakDur = breakSpan / speed;
		const patternDur = patternLength / speed;
		const wireAt = flightAt + breakDur + patternDur;

		gsap.set(q('[data-back-pose]'), { attr: { transform: '' } });
		gsap.set(backJet, { svgOrigin: '0 0', x: HOME.x, y: HOME.y, rotation: 0 });
		gsap.set(q('[data-home-label]'), { autoAlpha: 1 });
		gsap.set(q('[data-trap-label]'), { autoAlpha: 0 });
		gsap.set(q('[data-back-status]'), { autoAlpha: 1 });
		gsap.set(q('[data-back-ring]'), { autoAlpha: 0, transformOrigin: '50% 50%' });

		const tl = actTimeline(ref.current, 'squadron', isDesktop);

		tl.from(q('[data-eyebrow]'), { autoAlpha: 0, y: 12, duration: 0.04, ease: EASE.settle }, 0)
			.from(title.words, { yPercent: 110, duration: 0.07, ease: EASE.settle, stagger: 0.01 }, 0.01)
			.from(q('[data-lede]'), { autoAlpha: 0, y: 14, duration: 0.05, ease: EASE.settle }, 0.05)
			.fromTo(
				box,
				{ scale: 3.2, transformOrigin: `${lead.x}% ${lead.y}%` },
				{ scale: 1, duration: 0.34, ease: EASE.glide },
				0,
			)
			.from(q('[data-deck]'), { autoAlpha: 0, y: 30, duration: 0.1, ease: EASE.settle }, 0.26)
			.from(
				q('[data-label]'),
				{ autoAlpha: 0, y: 6, duration: 0.05, ease: EASE.settle, stagger: { each: 0.015, from: 'start' } },
				0.2,
			)
			.from(q('[data-dot]'), { scale: 0, duration: 0.04, ease: EASE.snap, stagger: 0.015 }, 0.24)
			.fromTo(q('[data-sea]'), { yPercent: 0 }, { yPercent: 8, duration: 1 }, 0)
			.fromTo(
				q('[data-op]'),
				{ autoAlpha: 0, y: 14 },
				{ autoAlpha: 1, y: 0, duration: 0.05, ease: EASE.settle, stagger: 0.03 },
				0.3,
			)

			.to(q('[data-home-label]'), { autoAlpha: 0, duration: 0.03 }, flightAt)
			.to(
				backJet,
				{ motionPath: { path: BREAK, autoRotate: 90 }, duration: breakDur, ease: EASE.catapult },
				flightAt,
			)
			.to(
				backJet,
				{ motionPath: { path: PATTERN, autoRotate: 90 }, duration: patternDur, ease: EASE.cruise },
				flightAt + breakDur,
			)
			.to(
				backJet,
				{ motionPath: { path: ROLLOUT, autoRotate: 90 }, duration: stopAt - wireAt, ease: EASE.coast },
				wireAt,
			)
			.to(q('[data-impact]'), { keyframes: { x: [0, -4, 3, -1, 0], y: [0, 2, -2, 1, 0] }, duration: 0.05 }, wireAt)
			.to(q('[data-trap-label]'), { autoAlpha: 1, duration: 0.03 }, wireAt)
			.fromTo(
				q('[data-tag-marker]'),
				{ y: 0, yPercent: 0 },
				{ y: 0, yPercent: 100, duration: 0.06, ease: EASE.snap },
				stopAt,
			)
			.fromTo(
				q('[data-back-ring]'),
				{ scale: 0.6, autoAlpha: 0.9 },
				{ scale: 2.6, autoAlpha: 0, duration: 0.08, ease: EASE.settle, immediateRender: false },
				stopAt,
			)
			.to(q('[data-back-status]'), { autoAlpha: 0, duration: 0.03 }, stopAt + 0.04)
			.to({}, { duration: 0.01 }, 0.99);

		q('[data-bob]').forEach((el, i) => {
			gsap.to(el, {
				y: i % 2 ? 4 : -4,
				duration: DUR.epic + (i % 3) * DUR.quick,
				ease: EASE.glide,
				repeat: -1,
				yoyo: true,
			});
		});

		return () => title.revert();
	});

	return (
		<section
			ref={ref}
			id="squadron"
			aria-labelledby="squadron-title"
			className="relative min-h-svh overflow-hidden bg-night-950"
		>
			<div data-sea aria-hidden="true" className="ocean absolute -inset-y-[10%] inset-x-0 will-change-transform" />

			<div className="relative z-10 mx-auto flex min-h-svh max-w-[1440px] flex-col px-5 pb-6 pt-20 md:grid md:grid-cols-[minmax(0,380px)_1fr] md:items-center md:gap-12 md:px-10 md:py-0">
				<div className="contents md:block">
					<div className="order-1">
						<p data-eyebrow className="eyebrow">
							Act V · The Squadron
						</p>
						<h2 id="squadron-title" data-title className="display mt-3 max-w-[12ch] text-display-act md:mt-5">
							One console. Every sortie.
						</h2>
						<p data-lede className="mt-3 max-w-sm text-sm leading-relaxed text-steel-300 md:mt-5 md:text-base">
							One jet per app, each with its live status. Redeploy, rollback and resize from the dashboard.
						</p>
					</div>
					<ul className="order-3 mt-5 grid gap-3 md:mt-10 md:gap-5">
						{OPS.map((o) => (
							<li key={o.verb} data-op className="border-t border-line pt-3">
								<p className="font-display text-lg font-bold uppercase tracking-wide md:text-xl">{o.verb}</p>
								<p className="mt-0.5 text-xs leading-snug text-steel-400 md:text-sm">{o.body}</p>
							</li>
						))}
					</ul>
				</div>

				<div data-impact className="order-2 my-4 w-full md:my-0">
					<div
						data-formation
						aria-hidden="true"
						className="relative mx-auto aspect-[4/3] w-full max-w-[760px] will-change-transform"
					>
						<div data-deck className="absolute inset-x-[8%] bottom-[4%] h-[16%]">
							<svg viewBox="0 0 600 96" preserveAspectRatio="none" className="h-full w-full">
								<path
									d="M0,48 L40,8 L540,6 L600,48 L540,90 L40,88 Z"
									fill={ART.panel}
									stroke="rgb(143 170 220 / 0.3)"
								/>
								<path d="M60,48 H560" stroke="rgb(255 178 74 / 0.45)" strokeDasharray="14 10" />
								<path d="M300,20 V76 M330,20 V76 M360,20 V76" stroke="rgb(143 170 220 / 0.35)" />
							</svg>
							<span className="absolute -bottom-5 left-0 font-code text-micro tracking-[0.2em] text-steel-500">
								DECK · RECOVERY
							</span>
						</div>

						<div className="absolute bottom-[22%] left-0 hidden w-[34%] font-code md:block text-micro md:text-mono">
							<p className="mb-1.5 tracking-[0.18em] text-steel-500">NOTES-API · TAGS</p>
							<div className="relative rounded border border-line bg-night-900/80">
								<span
									data-tag-marker
									className="absolute inset-x-0 top-0 h-1/3 rounded border border-deck-400/60 bg-deck-400/10"
									style={{ transform: 'translateY(100%)' }}
								/>
								{TAG_HISTORY.map((tag, i) => (
									<p key={tag} className="relative flex h-6 items-center justify-between px-2 text-steel-300">
										<span>:{tag.slice(0, 13)}…</span>
										<span className="text-steel-500">{i === 0 ? 'newest' : `-${i}`}</span>
									</p>
								))}
							</div>
						</div>

						{SQUADRON.map((j, i) =>
							i === ROLLBACK ? null : (
								<div key={j.name}>
									<div
										className="absolute w-[9%] -translate-x-1/2 -translate-y-1/2"
										style={{ left: `${j.x}%`, top: `${j.y}%` }}
									>
										<div data-bob>
											<JetPlan className="w-full" color={ART.jet} />
										</div>
									</div>
									<p
										data-label
										className="absolute flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap font-code text-micro text-steel-300 md:text-mono"
										style={{ left: `${j.x}%`, top: `calc(${j.y}% + 5.5%)` }}
									>
										<span data-dot className={`h-2 w-2 rounded-full ${STATUS_DOT[j.status]}`} />
										{j.name}
									</p>
								</div>
							),
						)}

						<p
							data-label
							data-home-label
							className="absolute flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap font-code text-micro text-steel-300 md:text-mono"
							style={{ left: `${SQUADRON[ROLLBACK].x}%`, top: `calc(${SQUADRON[ROLLBACK].y}% + 5.5%)`, opacity: 0 }}
						>
							<span className="h-2 w-2 rounded-full bg-deck-400" />
							{SQUADRON[ROLLBACK].name}
						</p>

						<svg
							viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
							className="absolute inset-0 h-full w-full overflow-visible"
							aria-hidden="true"
						>
							<circle
								data-back-ring
								cx={STOP.x}
								cy={STOP.y}
								r={JET_W * 0.7}
								fill="none"
								className="stroke-deck-400"
								strokeWidth="0.6"
								opacity="0"
							/>
							<g data-back-pose transform={`translate(${STOP.x} ${STOP.y}) rotate(-90)`}>
								<g data-back-jet>
									<JetPlan x={-JET_W / 2} y={-JET_H / 2} width={JET_W} height={JET_H} color={ART.jetReturning} />
								</g>
							</g>
						</svg>
						<p
							data-trap-label
							className="absolute flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap font-code text-micro text-steel-300 md:text-mono"
							style={{ left: `${TRAP.x}%`, top: `calc(${TRAP.y}% + 5.5%)` }}
						>
							<span className="relative grid h-2 w-2">
								<span data-front-status className="col-start-1 row-start-1 h-2 w-2 rounded-full bg-signal-400" />
								<span
									data-back-status
									className="col-start-1 row-start-1 h-2 w-2 rounded-full bg-deck-400"
									style={{ opacity: 0 }}
								/>
							</span>
							{SQUADRON[ROLLBACK].name}
							<span className="text-deck-300">
								· rolled back
							</span>
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
