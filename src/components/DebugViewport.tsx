import { useEffect, useState } from 'react';

/** Temporary diagnostic overlay — remove once the standalone viewport-height bug is fixed. */
export function DebugViewport() {
  const [info, setInfo] = useState<Record<string, string | number>>({});

  useEffect(() => {
    const update = () => {
      setInfo({
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        vvHeight: window.visualViewport?.height ?? 'n/a',
        vvWidth: window.visualViewport?.width ?? 'n/a',
        vvOffsetTop: window.visualViewport?.offsetTop ?? 'n/a',
        docClientHeight: document.documentElement.clientHeight,
        screenHeight: window.screen.height,
        screenAvailHeight: window.screen.availHeight,
        dpr: window.devicePixelRatio,
        standalone: String((navigator as unknown as { standalone?: boolean }).standalone ?? 'n/a'),
        displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
      });
    };
    update();
    window.visualViewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    const t = setTimeout(update, 600);
    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
      clearTimeout(t);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'rgba(255,0,0,0.85)',
        color: 'white',
        fontSize: 11,
        fontFamily: 'monospace',
        padding: '4px 8px',
        lineHeight: 1.4,
        whiteSpace: 'pre-wrap',
      }}
    >
      {Object.entries(info)
        .map(([k, v]) => `${k}: ${v}`)
        .join('  |  ')}
    </div>
  );
}
