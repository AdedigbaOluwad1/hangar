// apps/web/app/story/intro-guard.tsx
//
// Hero copy must not paint in its final position and then jump back to its
// intro start. This runs before first paint and hides [data-intro] elements
// with a style tag in <head> (React 19 tolerates foreign head nodes, so
// hydration is unaffected). The hero removes the tag once its intro is armed;
// the timeout restores the copy if the page's JavaScript never runs.
export const INTRO_GUARD_ID = 'story-intro-guard';

const script = `(function(){if(!matchMedia('(prefers-reduced-motion: no-preference)').matches)return;var s=document.createElement('style');s.id='${INTRO_GUARD_ID}';s.textContent='.story [data-intro]{visibility:hidden}';document.head.appendChild(s);setTimeout(function(){s.remove()},3000)})()`;

export function IntroGuard() {
	return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export function releaseIntroGuard() {
	document.getElementById(INTRO_GUARD_ID)?.remove();
}
