import { memo, useState } from 'react';
import { Soup } from 'lucide-react';

const FoodImage = memo(function FoodImage({ seed, alt, className = '', imgClassName = '' }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const src = `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600`;

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-cream-dark to-cream-deep ${className}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 shadow-card">
          <Soup className="h-6 w-6 text-ember-600" strokeWidth={2} />
        </div>
        <span className="sr-only">{alt}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-cream-dark ${className}`}>
      {!loaded && <div className="absolute inset-0 skeleton-shimmer" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover transition-all duration-500 ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'} ${imgClassName}`}
      />
    </div>
  );
});

export default FoodImage;
