import type { ReactNode } from 'react';
/** Mochi, le chat coach. Dessin original, en SVG. */
export function Mochi({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M12 26 L14 6 L28 18 Z" fill="#F2B84B" />
      <path d="M52 26 L50 6 L36 18 Z" fill="#F2B84B" />
      <circle cx="32" cy="36" r="24" fill="#F4EFE6" />
      <path d="M16 18 L14 8 L24 16 Z" fill="#E4572E" opacity=".35" />
      <circle cx="23" cy="34" r="3.6" fill="#16202B" />
      <circle cx="41" cy="34" r="3.6" fill="#16202B" />
      <circle cx="24.2" cy="32.8" r="1.1" fill="#fff" />
      <circle cx="42.2" cy="32.8" r="1.1" fill="#fff" />
      <path d="M29 42 Q32 45 35 42" stroke="#16202B" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="17" cy="42" r="3" fill="#E4572E" opacity=".3" />
      <circle cx="47" cy="42" r="3" fill="#E4572E" opacity=".3" />
      <circle cx="32" cy="18" r="4" fill="#2EBD85" />
    </svg>
  );
}

export function Bubble({ children }: { children: ReactNode }) {
  return (
    <div className="bubble">
      <Mochi />
      <p>{children}</p>
    </div>
  );
}
