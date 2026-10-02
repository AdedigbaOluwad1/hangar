// apps/web/app/story/acts/squadron.tsx
//
// Act 5: the camera pulls back from one jet to the whole squadron, one jet per
// deployed app. One breaks formation and traps back on deck: a rollback.
import { useRef } from 'react';
import { EASE, SCRUB, SplitText, gsap, pinLength, useAct } from '../motion';
import { JetPlan } from '../art/jet';
import { TAG_HISTORY } from '../data';

type Status = 'running' | 'building' | 'deploying';

const STATUS_DOT: Record<Status, string> = {
	running: 'bg-signal-400',
	building: 'bg-deck-400',
	deploying: 'bg-steel-300',
};

// illustrative homelab apps; positions are % of the formation box
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
// where the returning jet traps on the deck strip, as % of the formation box
const TRAP = { x: 64, y: 86 };

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
		const back = q('[data-back]');
		const backJet = q('[data-back-jet]');
		const home = SQUADRON[ROLLBACK];

		// The rollback jet's composed frame has it on deck. The wrapper is the
		// size of the formation box, so percent offsets are box-relative.
		gsap.set(back, { xPercent: home.x - TRAP.x, yPercent: home.y - TRAP.y });
		gsap.set(backJet, { rotation: 0 });
		gsap.set(q('[data-back-label]'), { autoAlpha: 0 });
		gsap.set(q('[data-back-status]'), { autoAlpha: 1 });

		const tl = gsap.timeline({
			defaults: { ease: EASE.scrub },
			scrollTrigger: {
				trigger: ref.current,
				start: 'top top',
				end: pinLength('squadron', isDesktop),
				pin: true,
				scrub: SCRUB,
			},
		});

		tl.from(q('[data-eyebrow]'), { autoAlpha: 0, y: 12, duration: 0.04, ease: EASE.settle }, 0)
			.from(title.words, { yPercent: 110, duration: 0.07, ease: EASE.settle, stagger: 0.01 }, 0.01)
			.from(q('[data-lede]'), { autoAlpha: 0, y: 14, duration: 0.05, ease: EASE.settle }, 0.05)
			// pull back from the lead jet to the whole formation
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

			// rollback: the jet peels off, turns back and traps on deck
			.to(q('[data-front-status]'), { autoAlpha: 0, duration: 0.03 }, 0.42)
			.to(q('[data-back-label]'), { autoAlpha: 1, duration: 0.03 }, 0.42)
			.to(backJet, { rotation: 180, duration: 0.12, ease: EASE.glide }, 0.44)
			.to(back, { xPercent: 0, yPercent: 0, duration: 0.24, ease: EASE.brake }, 0.48)
			// echo of the launch impact, much smaller
			.to(q('[data-impact]'), { keyframes: { x: [0, -4, 3, -1, 0], y: [0, 2, -2, 1, 0] }, duration: 0.05 }, 0.66)
			.fromTo(
				q('[data-tag-marker]'),
				{ y: 0, yPercent: 0 },
				{ y: 0, yPercent: 100, duration: 0.06, ease: EASE.snap },
				0.66,
			)
			.fromTo(
				q('[data-back-ring]'),
				{ scale: 0.6, autoAlpha: 0.9 },
				{ scale: 2.6, autoAlpha: 0, duration: 0.08, ease: EASE.settle },
				0.66,
			)
			.to(backJet, { rotation: 360, duration: 0.1, ease: EASE.glide }, 0.74)
			.to(q('[data-back-status]'), { autoAlpha: 0, duration: 0.03 }, 0.8)
			.to(q('[data-front-status]'), { autoAlpha: 1, duration: 0.03 }, 0.8)
			.to({}, { duration: 0.01 }, 0.99);

		// jets in formation never sit perfectly still
		q('[data-bob]').forEach((el, i) => {
			gsap.to(el, { y: i % 2 ? 4 : -4, duration: 1.6 + (i % 3) * 0.3, ease: EASE.glide, repeat: -1, yoyo: true });
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
						<h2
							id="squadron-title"
							data-title
							className="display mt-3 max-w-[12ch] text-[clamp(2.5rem,5.4vw,5rem)] md:mt-5"
						>
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
								<path d="M0,48 L40,8 L540,6 L600,48 L540,90 L40,88 Z" fill="#0b1220" stroke="rgb(143 170 220 / 0.3)" />
								<path d="M60,48 H560" stroke="rgb(255 178 74 / 0.45)" strokeDasharray="14 10" />
								<path d="M300,20 V76 M330,20 V76 M360,20 V76" stroke="rgb(143 170 220 / 0.35)" />
							</svg>
							<span className="absolute -top-5 left-0 font-code text-[10px] tracking-[0.2em] text-steel-500">
								DECK · RECOVERY
							</span>
						</div>

						<div className="absolute bottom-[22%] right-0 hidden w-[34%] font-code md:block text-[10px] md:text-[11px]">
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
											<JetPlan className="w-full" />
										</div>
									</div>
									<p
										data-label
										className="absolute flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap font-code text-[10px] text-steel-300 md:text-[11px]"
										style={{ left: `${j.x}%`, top: `calc(${j.y}% + 5.5%)` }}
									>
										<span data-dot className={`h-2 w-2 rounded-full ${STATUS_DOT[j.status]}`} />
										{j.name}
									</p>
								</div>
							),
						)}

						<div data-back className="absolute inset-0">
							<div
								className="absolute w-[9%] -translate-x-1/2 -translate-y-1/2"
								style={{ left: `${TRAP.x}%`, top: `${TRAP.y}%` }}
							>
								<div data-back-jet>
									<JetPlan className="w-full" color="#3a4d70" />
								</div>
								<span
									data-back-ring
									className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 rounded-full border border-deck-400"
									style={{ opacity: 0 }}
								/>
							</div>
							<p
								data-label
								className="absolute flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap font-code text-[10px] text-steel-300 md:text-[11px]"
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
								<span data-back-label className="text-deck-300">
									· rolled back
								</span>
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
