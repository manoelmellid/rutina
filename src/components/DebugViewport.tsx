import { useEffect, useState } from 'react';

/** Temporary diagnostic overlay — remove once the standalone viewport-height bug is fixed. */
export function DebugViewport() {
  const [info, setInfo] = useState<Record<string, string | number>>({});

  useEffect(() => {
    const update = () => {
      const appHeightVar = getComputedStyle(document.documentElement).getPropertyValue('--app-height');
      const pageEl = document.querySelector('[data-debug-page]');
      const tabBarEl = document.querySelector('[data-debug-tabbar]');
      const pageRect = pageEl?.getBoundingClientRect();
      const tabRect = tabBarEl?.getBoundingClientRect();

      setInfo({
        innerHeight: window.innerHeight,
        vvHeight: window.visualViewport?.height ?? 'n/a',
        screenHeight: window.screen.height,
        appHeightVar: appHeightVar.trim() || 'unset',
        standalone: String((navigator as unknown as { standalone?: boolean }).standalone ?? 'n/a'),
        pageTop: pageRect ? pageRect.top.toFixed(0) : 'n/a',
        pageBottom: pageRect ? pageRect.bottom.toFixed(0) : 'n/a',
        pageHeight: pageRect ? pageRect.height.toFixed(0) : 'n/a',
        tabTop: tabRect ? tabRect.top.toFixed(0) : 'n/a',
        tabBottom: tabRect ? tabRect.bottom.toFixed(0) : 'n/a',
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
        background: 'rgba(255,0,0,0.9)',
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
