import { type RefObject, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { useGSAP } from '@gsap/react';

export const EASE = {
	throttle: 'hangar.throttle',
	settle: 'hangar.settle',
	glide: 'hangar.glide',
	snap: 'hangar.snap',
	brake: 'hangar.brake',
	spool: 'hangar.spool',
	catapult: 'hangar.catapult',
	coast: 'hangar.coast',
	cruise: 'none',
	scrub: 'none',
	impact: 'none',
} as const;

const CURVES: Record<string, string> = {
	[EASE.throttle]: '0.7,0,0.84,0',
	[EASE.settle]: '0.16,1,0.3,1',
	[EASE.glide]: '0.65,0,0.35,1',
	[EASE.snap]: '0.34,1.45,0.64,1',
	[EASE.brake]: '0.05,0.7,0.1,1',
	[EASE.spool]: '0.5,0,0.75,0',
	[EASE.catapult]: '0.33,0,0.67,0.33',
	[EASE.coast]: '0.33,0.67,0.67,1',
};

function bezier(ease: string) {
	return (CURVES[ease] ?? '0,0,1,1').split(',').map(Number);
}

export function entrySpeed(ease: string) {
	const [x1, y1] = bezier(ease);
	return x1 === 0 ? Infinity : y1 / x1;
}

export function exitSpeed(ease: string) {
	const [, , x2, y2] = bezier(ease);
	return x2 === 1 ? Infinity : (1 - y2) / (1 - x2);
}

export const DUR = {
	impact: 0.06,
	instant: 0.12,
	quick: 0.24,
	base: 0.48,
	slow: 0.8,
	epic: 1.4,
} as const;

export const STAGGER = {
	chars: 0.018,
	tight: 0.04,
	base: 0.08,
	loose: 0.14,
	wide: 0.22,
} as const;

export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

let eased = false;
export function registerEases() {
	if (eased || typeof window === 'undefined') return;
	gsap.registerPlugin(useGSAP, CustomEase);
	for (const [name, curve] of Object.entries(CURVES)) CustomEase.create(name, curve);
	eased = true;
}

function motionAllowed() {
	return typeof window !== 'undefined' && window.matchMedia(MOTION_OK).matches;
}

export function useReveal(scope: RefObject<HTMLElement | null>, ready: boolean) {
	const played = useRef(false);
	useGSAP(
		() => {
			if (!ready || played.current) return;
			played.current = true;
			if (!motionAllowed()) return;
			registerEases();
			gsap.from('[data-reveal]', {
				autoAlpha: 0,
				y: 14,
				duration: DUR.slow,
				ease: EASE.settle,
				stagger: STAGGER.tight,
				clearProps: 'transform,opacity,visibility',
			});
		},
		{ scope, dependencies: [ready] },
	);
}

export function useCountUp(ref: RefObject<HTMLElement | null>, value: number) {
	const from = useRef(0);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (!motionAllowed()) {
			el.textContent = String(value);
			from.current = value;
			return;
		}
		registerEases();
		const counter = { n: from.current };
		const tween = gsap.to(counter, {
			n: value,
			duration: DUR.slow,
			ease: EASE.settle,
			onUpdate: () => {
				el.textContent = String(Math.round(counter.n));
			},
		});
		from.current = value;
		return () => {
			tween.kill();
		};
	}, [ref, value]);
}

export { gsap };
