/**
 * In iOS standalone PWAs (viewport-fit=cover), .page is fixed-positioned at the
 * true physical top of the screen (behind the status bar), but
 * window.innerHeight / visualViewport.height exclude the status bar's height
 * from their measurement — leaving a gap at the bottom equal to that
 * difference. window.screen.height reflects the true physical height and
 * fixes that gap. In a regular Safari tab there's no such offset, and
 * screen.height would be too tall (it doesn't account for Safari's own
 * chrome), so we keep using innerHeight/visualViewport there instead.
 */
export function initAppHeight(): void {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  const setHeight = () => {
    const height = isStandalone ? window.screen.height : (window.visualViewport?.height ?? window.innerHeight);
    document.documentElement.style.setProperty('--app-height', `${height}px`);
  };

  setHeight();
  window.visualViewport?.addEventListener('resize', setHeight);
  window.addEventListener('resize', setHeight);
  window.addEventListener('orientationchange', setHeight);
}
