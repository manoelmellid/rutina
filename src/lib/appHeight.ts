/**
 * iOS standalone PWAs sometimes report window.innerHeight / 100vh / 100dvh as if
 * Safari's chrome still reserved space at the bottom, even though there's no
 * chrome to show. Measuring the real visible height via the Visual Viewport API
 * and writing it to a CSS var sidesteps that unit-level bug entirely.
 */
export function initAppHeight(): void {
  const setHeight = () => {
    const height = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${height}px`);
  };

  setHeight();
  window.visualViewport?.addEventListener('resize', setHeight);
  window.addEventListener('resize', setHeight);
  window.addEventListener('orientationchange', setHeight);
}
