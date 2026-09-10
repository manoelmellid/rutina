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
 *
 * Also compensates for a WebKit bug (WebKit bug 297779, active as of iOS 26):
 * visualViewport.offsetTop drifts when the keyboard opens/closes and doesn't
 * reliably reset, so `position: fixed` elements (anchored to the layout
 * viewport, not the visual one) end up visibly offset from where the user is
 * actually looking. We can't fix WebKit's positioning, so `.page` stops
 * relying on it being correct and instead translates itself by
 * -offsetTop via `--app-offset-top`, keeping it pinned to the visual
 * viewport regardless of what the layout viewport thinks.
 */
export function initAppHeight(): void {
  const setHeight = () => {
    const vv = window.visualViewport;
    const height = vv?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${height}px`);
    document.documentElement.style.setProperty('--app-offset-top', `${vv?.offsetTop ?? 0}px`);
  };

  setHeight();
  window.visualViewport?.addEventListener('resize', setHeight);
  window.visualViewport?.addEventListener('scroll', setHeight);
  window.addEventListener('resize', setHeight);
  window.addEventListener('orientationchange', setHeight);
}
