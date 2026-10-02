import { type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { useGSAP } from '@gsap/react';
import { MOTION_OK, registerEases } from '../lib/motion';

export { EASE, DUR, STAGGER } from '../lib/motion';

export const SCRUB = 0.8;

export const PIN = {
	deck: { desktop: 110, mobile: 90 },
	hangar: { desktop: 260, mobile: 220 },
	crew: { desktop: 320, mobile: 300 },
	launch: { desktop: 240, mobile: 200 },
	squadron: { desktop: 240, mobile: 200 },
	fleet: { desktop: 140, mobile: 120 },
} as const;

let registered = false;
function register() {
	if (registered || typeof window === 'undefined') return;
	registerEases();
	gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);
	registered = true;
}

export interface ActContext {
	isDesktop: boolean;
	q: (selector: string) => Element[];
	root: HTMLElement;
}

const pending = new Map<HTMLElement, () => void>();

function inDocumentOrder(a: HTMLElement, b: HTMLElement) {
	return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

export function flushActs(until?: HTMLElement) {
	for (const root of [...pending.keys()].sort(inDocumentOrder)) {
		if (until && inDocumentOrder(until, root) < 0) break;
		const build = pending.get(root);
		pending.delete(root);
		build?.();
	}
}

export function useAct(
	scope: RefObject<HTMLElement | null>,
	setup: (ctx: ActContext) => void | (() => void),
	{ eager = false }: { eager?: boolean } = {},
) {
	useGSAP(
		() => {
			register();
			const root = scope.current;
			if (!root) return;
			const mm = gsap.matchMedia();
			const build = () =>
				mm.add(
					{
						isDesktop: `${MOTION_OK} and (min-width: 768px)`,
						isMobile: `${MOTION_OK} and (max-width: 767px)`,
					},
					(ctx) => {
						const { isDesktop, isMobile } = ctx.conditions ?? {};
						if (!isDesktop && !isMobile) return;
						return setup({ isDesktop: !!isDesktop, q: gsap.utils.selector(root), root });
					},
					root,
				);

			if (eager) {
				build();
				return () => mm.revert();
			}

			pending.set(root, build);
			const io = new IntersectionObserver(
				(entries) => {
					if (!entries.some((e) => e.isIntersecting)) return;
					io.disconnect();
					flushActs(root);
				},
				{ rootMargin: '0px 0px 100% 0px' },
			);
			io.observe(root);
			return () => {
				io.disconnect();
				pending.delete(root);
				mm.revert();
			};
		},
		{ scope },
	);
}

export function actTop(id: string) {
	const el = document.getElementById(id);
	if (!el) return null;
	const box = el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el;
	return box.getBoundingClientRect().top + window.scrollY;
}

export function jumpToAct(id: string) {
	flushActs();
	ScrollTrigger.refresh();
	const top = actTop(id);
	if (top !== null) window.scrollTo({ top, behavior: 'auto' });
}

export function pinLength(act: keyof typeof PIN, isDesktop: boolean) {
	return `+=${PIN[act][isDesktop ? 'desktop' : 'mobile']}%`;
}

export { gsap, ScrollTrigger, SplitText };
