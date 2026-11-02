// Simple line icons (no emojis). Use: <Ico name="bag" />
const P = {
  plane: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z',
  bag: 'M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M5 7h14v13H5zM9 11v5M15 11v5',
  meal: 'M6 3v7a2 2 0 0 0 2 2v9M10 3v7M18 3c-2 2-3 5-3 8h3v10',
};
export default function Ico({ name, size = 16, color = 'currentColor', style }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', verticalAlign: '-3px', ...style }}>
      <path d={P[name]} />
    </svg>
  );
}
