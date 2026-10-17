/* Einfache Strich-Icons (2 px, currentColor) statt Emojis, docs/design.md 4.16 */

const Svg = ({ children, label }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined}>
    {children}
  </svg>
);

export const IconPeople = () => (
  <Svg><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M16.5 14.6c2.6.1 4.5 1.8 5 4.9" /></Svg>
);
export const IconUndo = () => (
  <Svg><path d="M9 7H4V2" /><path d="M4 7c2-3 5-4.5 8.5-4.5A8.5 8.5 0 1 1 4.6 15" /></Svg>
);
export const IconPause = ({ label }) => (
  <Svg label={label}><path d="M9 5v14M15 5v14" /></Svg>
);
export const IconPlay = ({ label }) => (
  <Svg label={label}><path d="M7 4.5v15l12-7.5z" /></Svg>
);
export const IconWarning = () => (
  <Svg><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17v.5" /></Svg>
);
export const IconCards = () => (
  <Svg><rect x="3" y="5" width="11" height="15" rx="2" /><path d="M10 4.5 12 3.6a2 2 0 0 1 2.6 1.1L19.7 17a2 2 0 0 1-1.1 2.6l-3.6 1.5" /></Svg>
);
export const IconClock = () => (
  <Svg><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9.5 2.5h5" /></Svg>
);
