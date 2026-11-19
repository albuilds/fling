/**
 * The Fling mark: the top-left corner of a capture frame and a slash for the
 * "fling" motion. Drawn with currentColor so it follows the text color.
 */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5 19V5h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="square"
      />
      <path
        d="M12.5 27.5 27.5 12.5"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="square"
      />
    </svg>
  );
}

/** Mark plus wordmark, linking home. */
export function Brand({ href = "/" }: { href?: string }) {
  return (
    <a className="brand" href={href} aria-label="Fling home">
      <LogoMark />
      <span className="wordmark">fling</span>
    </a>
  );
}
