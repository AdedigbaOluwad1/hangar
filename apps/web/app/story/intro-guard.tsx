export const INTRO_GUARD_ID = 'story-intro-guard';

const GUARD_TIMEOUT_MS = 3000;

const script = `(function(){if(!matchMedia('(prefers-reduced-motion: no-preference)').matches)return;var s=document.createElement('style');s.id='${INTRO_GUARD_ID}';s.textContent='.story [data-intro]{visibility:hidden}';document.head.appendChild(s);setTimeout(function(){s.remove()},${GUARD_TIMEOUT_MS})})()`;

export function IntroGuard() {
	return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export function releaseIntroGuard() {
	document.getElementById(INTRO_GUARD_ID)?.remove();
}
