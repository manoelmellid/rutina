/**
 * Track the real visible viewport height in a CSS var, so .page can size
 * itself from it instead of vh/dvh (unreliable across iOS versions/modes).
 *
 * We tried using window.screen.height in standalone mode to reach the true
 * physical screen edge, but elementFromPoint() confirmed the OS reserves the
 * bottom ~47px (status bar + home indicator) as non-interactive: content
 * painted there gets covered by a native black layer, clipping the tab bar.
 * innerHeight/visualViewport.height reflect the actual usable area on every
 * mode, standalone included, so we always use that instead.
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
