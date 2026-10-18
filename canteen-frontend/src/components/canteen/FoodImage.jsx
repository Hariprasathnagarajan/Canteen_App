import { memo } from 'react';
import { EMPTY_ART } from '../lineart';

const PALETTES = [
  ['#DBE9FF', '#BDD6FF'],
  ['#E2E8F0', '#CBD5E1'],
  ['#E0E9FF', '#C7D7FE'],
  ['#D9E2EC', '#BCCEE4'],
  ['#E8EDF3', '#CFD8E3'],
  ['#DCE6F5', '#BFDBFE'],
  ['#E3E7EE', '#C4D0E0'],
  ['#DEE7F2', '#B9C9DF'],
  ['#E6EAF0', '#CDD6E1'],
  ['#D7E3F4', '#B3C7E8'],
];

const GLYPHS = ['cup', 'croissant', 'teapot', 'pastry', 'tray', 'beans'];

const hashSeed = (seed) => {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
};

const FoodImage = memo(function FoodImage({ seed, alt, className = '', imgClassName = '' }) {
  const [from, to] = PALETTES[hashSeed(seed || 'canteen') % PALETTES.length];
  const Art = EMPTY_ART[GLYPHS[hashSeed(seed || 'canteen') % GLYPHS.length]];

  return (
    <div
      role="img"
      aria-label={alt}
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <Art
        className={`h-1/2 w-1/2 max-h-10 max-w-10 text-slate-700/40 ${imgClassName}`}
      />
    </div>
  );
});

export default FoodImage;
