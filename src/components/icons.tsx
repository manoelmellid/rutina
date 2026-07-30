interface IconProps {
  className?: string;
}

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconHoy({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...common}>
      <path d="M3.5 11.5 12 4l8.5 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function IconComidas({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...common}>
      <path d="M6 3v6.5a1.5 1.5 0 0 0 3 0V3" />
      <path d="M7.5 3v18" />
      <path d="M17 3c-1.4 0-2.5 1.8-2.5 5s1.1 4.7 2 5v10" />
    </svg>
  );
}

export function IconCompra({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...common}>
      <path d="M4 5h2l1.2 9.6a1.5 1.5 0 0 0 1.5 1.3h7.6a1.5 1.5 0 0 0 1.5-1.2L19 8H7" />
      <circle cx="10" cy="20" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="20" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconFinanzas({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...common}>
      <path d="M16 5.5c-1.2-1-2.7-1.5-4.2-1.3-2.8.4-4.8 3-4.4 6s3 4.8 6 4.4c1.5-.2 2.8-1 3.6-2.2" />
      <path d="M5.5 10h7M5.5 13h6" />
    </svg>
  );
}

export function IconGym({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...common}>
      <rect x="2.8" y="9.3" width="3" height="5.4" rx="1" fill="currentColor" stroke="none" />
      <rect x="18.2" y="9.3" width="3" height="5.4" rx="1" fill="currentColor" stroke="none" />
      <path d="M7.8 12h8.4" strokeWidth={2.2} />
    </svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...common}>
      <path d="M12 5v14M5 12h14" strokeWidth={2} />
    </svg>
  );
}

export function IconGear({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5M18.4 18.4l-1.5-1.5M7.1 7.1 5.6 5.6" />
    </svg>
  );
}
