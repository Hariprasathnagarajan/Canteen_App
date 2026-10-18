import { memo, cloneElement, isValidElement, Children } from 'react';

const DRAWABLE = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);

const injectDraw = (node, counter, base, step) => {
  if (!isValidElement(node)) return node;
  const type = typeof node.type === 'string' ? node.type : null;
  const cls = (node.props && node.props.className) || '';
  if (type === 'defs' || type === 'pattern' || cls.includes('animate-steam')) return node;
  const kids =
    node.props && node.props.children != null
      ? Children.map(node.props.children, (child) => injectDraw(child, counter, base, step))
      : node.props.children;
  if (type && DRAWABLE.has(type)) {
    const i = counter.i;
    counter.i += 1;
    return cloneElement(node, {
      pathLength: 1,
      children: kids,
      style: {
        ...(node.props.style || {}),
        strokeDasharray: 1,
        '--dash': '1',
        animation: 'drawLine 1.1s cubic-bezier(0.16,1,0.3,1) both',
        animationDelay: `${base + i * step}s`,
      },
    });
  }
  return cloneElement(node, undefined, kids);
};

const Svg = ({ children, className = '', viewBox = '0 0 48 48', strokeWidth = 1.5, draw = true, drawBase = 0.05, drawStep = 0.08 }) => {
  const content = draw ? injectDraw(children, { i: 0 }, drawBase, drawStep) : children;
  return (
    <svg
      viewBox={viewBox}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {content}
    </svg>
  );
};

const CupGlyph = memo(function CupGlyph({ className = '', steam = false, draw = true }) {
  return (
    <Svg className={className} draw={draw}>
      {steam && (
        <g className="animate-steam" style={{ animationDelay: '0s' }}>
          <path d="M19 13 C19 10.5 21 9.5 21 7" />
        </g>
      )}
      {steam && (
        <g className="animate-steam" style={{ animationDelay: '1.1s' }}>
          <path d="M26.5 13.5 C26.5 11 28.5 10 28.5 7.5" />
        </g>
      )}
      <path d="M11 17 H36 L34 31 C33.2 36 29 39.5 24 39.5 C19.4 39.5 15.4 36.2 14.5 31.6 Z" />
      <path d="M36 21 C41 21 43.5 24 42.5 27.5 C41.6 30.6 38.6 32 35.5 32" />
      <path d="M9 43 H39" />
    </Svg>
  );
});

const CroissantGlyph = memo(function CroissantGlyph({ className = '', draw = true }) {
  return (
    <Svg className={className} draw={draw}>
      <path d="M6.5 31 C6.5 19.5 15.5 11.5 26 11.5 C35.5 11.5 42.5 18 43 26.5 C43.1 28.6 41.3 29.6 40.2 28 C37.8 22.6 33 19 27 19 C19.8 19 14.4 24.2 13.6 31.3 C13.3 33.9 10.7 35 8.6 33.6 C7.2 32.7 6.5 31.9 6.5 31 Z" />
      <path d="M19.5 12.6 C20.8 15 21.3 17.3 21 19.6" />
      <path d="M30.5 13.4 C28.7 15.6 27.6 17.6 27.2 19.4" />
    </Svg>
  );
});

const BeansGlyph = memo(function BeansGlyph({ className = '', draw = true }) {
  return (
    <Svg className={className} draw={draw}>
      <ellipse cx="19" cy="26" rx="7.5" ry="11" transform="rotate(-35 19 26)" />
      <path d="M15.8 19.4 C18.5 22.5 20.5 27 21.9 32.4" />
      <ellipse cx="31.5" cy="23.5" rx="7" ry="10.5" transform="rotate(25 31.5 23.5)" />
      <path d="M34.2 17.2 C32.3 20.8 31.1 25.2 30.8 30" />
    </Svg>
  );
});

const TeapotGlyph = memo(function TeapotGlyph({ className = '', draw = true }) {
  return (
    <Svg className={className} draw={draw}>
      <path d="M13 25 C13 19.5 17.9 15.5 24 15.5 C30.1 15.5 35 19.5 35 25 C35 30.5 30.1 34.5 24 34.5 C17.9 34.5 13 30.5 13 25 Z" />
      <path d="M17.5 17.8 C19.4 15.9 21.6 14.9 24 14.9 C26.4 14.9 28.6 15.9 30.5 17.8" />
      <path d="M24 14.9 V11.8" />
      <circle cx="24" cy="10.2" r="1.7" />
      <path d="M34.8 22.5 C39.3 21.5 41.9 23.6 43.4 27" />
      <path d="M13.4 22 C9.5 21.5 7.5 24.5 8 27.5 C8.4 29.9 10.4 31.4 13 31.7" />
      <path d="M20 9.6 C20 7.6 21.8 6.9 21.8 5.1" />
      <path d="M27.4 10.1 C27.4 8.1 29.2 7.4 29.2 5.6" />
    </Svg>
  );
});

const PastryGlyph = memo(function PastryGlyph({ className = '', draw = true }) {
  return (
    <Svg className={className} draw={draw}>
      <path d="M13 25 H35 L32.5 38.5 H15.5 Z" />
      <path d="M19.5 25 L18.9 38.5" />
      <path d="M24 25 V38.5" />
      <path d="M28.5 25 L29.1 38.5" />
      <path d="M13 25 C12.5 20.5 15.5 17 19.5 16.8 C20 13 23.5 10.5 27 11.8 C31 10.8 34.5 14 34 18.2 C36.5 20 37 23.5 35 25" />
    </Svg>
  );
});

const CutleryGlyph = memo(function CutleryGlyph({ className = '', draw = true }) {
  return (
    <Svg className={className} draw={draw}>
      <path d="M12.5 7 V15" />
      <path d="M17.5 7 V15" />
      <path d="M22.5 7 V15" />
      <path d="M11.5 15 C11.5 18.5 14.5 18.2 17.5 18.2 C20.5 18.2 23.5 18.5 23.5 15" />
      <path d="M17.5 18.2 V41" />
      <path d="M32 6 C35.5 10 36.5 16 35.5 21.5 C35.1 23.4 33.8 24.3 32 24.3 V41" />
      <path d="M32 6 V24.3" />
    </Svg>
  );
});

const ReceiptGlyph = memo(function ReceiptGlyph({ className = '', draw = true }) {
  return (
    <Svg className={className} draw={draw}>
      <path d="M13 7 H35 V37 L31 34.5 L27 37 L23 34.5 L19 37 L15 34.5 L13 36 Z" />
      <path d="M17 14 H31" />
      <path d="M17 20 H31" />
      <path d="M17 26 H26" />
    </Svg>
  );
});

const TrayGlyph = memo(function TrayGlyph({ className = '', draw = true }) {
  return (
    <Svg className={className} draw={draw}>
      <path d="M6 30 H42" />
      <path d="M9 30 C9 34.4 12.6 37.4 17 37.4 H31 C35.4 37.4 39 34.4 39 30" />
      <path d="M14 30 C14 22.5 19.4 17 25.5 17 C31.6 17 37 22.5 37 30" />
      <path d="M25.5 17 V14.4" />
      <circle cx="25.5" cy="13" r="1.5" />
    </Svg>
  );
});

const EMPTY_ART = {
  cup: CupGlyph,
  croissant: CroissantGlyph,
  beans: BeansGlyph,
  teapot: TeapotGlyph,
  pastry: PastryGlyph,
  cutlery: CutleryGlyph,
  receipt: ReceiptGlyph,
  tray: TrayGlyph,
};

const LineCupLoader = memo(function LineCupLoader({ className = 'h-14 w-14', delay = 0 }) {
  const draw = (d, i, dash = 1) => (
    <path
      key={i}
      d={d}
      pathLength={1}
      style={{
        strokeDasharray: dash,
        '--dash': dash,
        animation: 'drawLine 1.4s cubic-bezier(0.16,1,0.3,1) both',
        animationDelay: `${delay + i * 0.18}s`,
      }}
    />
  );
  return (
    <Svg viewBox="0 0 64 64" className={className} strokeWidth={2} draw={false}>
      {draw('M14 23 H45 L42.8 41 C41.9 47 36.8 51.6 30.5 51.6 C24.8 51.6 19.9 47.8 18.7 42.4 L14 23 Z', 0)}
      {draw('M45 28 C50.5 28 53.5 31.5 52.5 35.5 C51.6 39.2 48 41 44.5 41', 1)}
      {draw('M11 57 H48', 2)}
      {draw('M25 17 C25 13.5 28 12.5 28 9', 3, 0.55)}
      {draw('M34.5 18 C34.5 14.5 37.5 13.5 37.5 10', 4, 0.55)}
    </Svg>
  );
});

const SteamCurls = memo(function SteamCurls({ className = '', draw = false }) {
  return (
    <Svg viewBox="0 0 48 48" className={className} draw={draw}>
      <g className="animate-steam">
        <path d="M17 40 C17 34 22 31 22 25 C22 20 18 17 18 11" />
      </g>
      <g className="animate-steam" style={{ animationDelay: '0.9s' }}>
        <path d="M31 42 C31 36.5 35.5 33.5 35.5 28 C35.5 23 32 20.5 32 15" />
      </g>
    </Svg>
  );
});

const LinkedLineBand = memo(function LinkedLineBand({ className = '', strokeWidthOverride }) {
  return (
    <svg
      viewBox="0 0 1200 130"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidthOverride ?? 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Linked line art connecting a coffee cup, coffee bean, croissant and teapot"
    >
      <path
        pathLength={1}
        style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.7s cubic-bezier(0.16,1,0.3,1) both' }}
        d="M0 66 C70 44 120 88 186 66"
      />
      <path
        pathLength={1}
        style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.55s' }}
        d="M254 66 C316 88 366 44 430 66"
      />
      <path
        pathLength={1}
        style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '1.05s' }}
        d="M476 66 C540 88 586 46 652 66"
      />
      <path
        pathLength={1}
        style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '1.55s' }}
        d="M736 66 C800 88 846 44 912 66"
      />
      <path
        pathLength={1}
        style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '2.1s' }}
        d="M984 66 C1044 84 1090 50 1148 66"
      />

      <g transform="translate(186 30) scale(1.5)">
        <path pathLength={1} style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.55s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.3s' }}
          d="M11 17 H36 L34 31 C33.2 36 29 39.5 24 39.5 C19.4 39.5 15.4 36.2 14.5 31.6 Z" />
        <path pathLength={1} style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.5s' }}
          d="M36 21 C41 21 43.5 24 42.5 27.5 C41.6 30.6 38.6 32 35.5 32" />
        <path pathLength={1} style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.3s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.65s' }}
          d="M9 43 H39" />
        <g className="animate-steam" style={{ animationDelay: '1.6s' }}>
          <path d="M20 13 C20 10.5 22 9.5 22 7" />
        </g>
      </g>

      <g transform="translate(430 40)">
        <ellipse pathLength={1} cx="23" cy="26" rx="16" ry="23" transform="rotate(-30 23 26)"
          style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.55s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.85s' }} />
        <path pathLength={1} d="M15.5 11.5 C21 18 25.5 27 28.5 38"
          style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '1s' }} />
      </g>

      <g transform="translate(652 38) scale(1.7)">
        <path pathLength={1}
          d="M6.5 31 C6.5 19.5 15.5 11.5 26 11.5 C35.5 11.5 42.5 18 43 26.5 C43.1 28.6 41.3 29.6 40.2 28 C37.8 22.6 33 19 27 19 C19.8 19 14.4 24.2 13.6 31.3 C13.3 33.9 10.7 35 8.6 33.6 C7.2 32.7 6.5 31.9 6.5 31 Z"
          style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '1.3s' }} />
        <path pathLength={1} d="M19.5 12.6 C20.8 15 21.3 17.3 21 19.6"
          style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.3s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '1.55s' }} />
        <path pathLength={1} d="M30.5 13.4 C28.7 15.6 27.6 17.6 27.2 19.4"
          style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.3s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '1.62s' }} />
      </g>

      <g transform="translate(912 32) scale(1.55)">
        <path pathLength={1} d="M13 25 C13 19.5 17.9 15.5 24 15.5 C30.1 15.5 35 19.5 35 25 C35 30.5 30.1 34.5 24 34.5 C17.9 34.5 13 30.5 13 25 Z"
          style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.55s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '1.8s' }} />
        <path pathLength={1} d="M34.8 22.5 C39.3 21.5 41.9 23.6 43.4 27"
          style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.3s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '2s' }} />
        <path pathLength={1} d="M13.4 22 C9.5 21.5 7.5 24.5 8 27.5 C8.4 29.9 10.4 31.4 13 31.7"
          style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.3s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '2.05s' }} />
        <path pathLength={1} d="M24 14.9 V11.8"
          style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.2s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '2.1s' }} />
        <circle cx="24" cy="10.2" r="1.7"
          style={{ strokeDasharray: 1, '--dash': '1', animation: 'drawLine 0.3s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '2.2s' }} />
        <g className="animate-steam" style={{ animationDelay: '0.4s' }}>
          <path d="M20 9.6 C20 7.6 21.8 6.9 21.8 5.1" />
        </g>
      </g>

      <circle cx="186" cy="66" r="3.5" fill="currentColor" stroke="none" style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.6s' }} />
      <circle cx="430" cy="66" r="3.5" fill="currentColor" stroke="none" style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '1.1s' }} />
      <circle cx="652" cy="66" r="3.5" fill="currentColor" stroke="none" style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '1.6s' }} />
      <circle cx="912" cy="66" r="3.5" fill="currentColor" stroke="none" style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '2.15s' }} />
      <circle cx="1148" cy="66" r="3.5" fill="currentColor" stroke="none" style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '2.55s' }} />
    </svg>
  );
});

const CafeHeroScene = memo(function CafeHeroScene({ className = '' }) {
  return (
    <svg
      viewBox="0 0 720 520"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Line art illustration of a cafe counter with an espresso machine, coffee cup, croissant and pastry"
    >
      <defs>
        <pattern id="la-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.2" fill="#BDD6FF" stroke="none" />
        </pattern>
      </defs>
      <g>{injectDraw(
        <>
          <rect x="470" y="36" width="216" height="150" rx="14" stroke="#BDD6FF" />
          <rect x="486" y="52" width="184" height="118" rx="8" fill="url(#la-grid)" stroke="none" />
          <path d="M506 78 H650" stroke="#5797FF" />
          <path d="M506 102 H624" stroke="#94BDFF" />
          <path d="M506 124 H642" stroke="#94BDFF" />
          <path d="M506 146 H590" stroke="#94BDFF" />
          <path d="M636 138 C636 133 640 131 640 126" stroke="#5797FF" />
          <path d="M646 140 C646 135 650 133 650 128" stroke="#5797FF" />
          <circle cx="643" cy="154" r="7" stroke="#0048BB" />

          <path d="M50 96 H360" stroke="#94BDFF" />
          <path d="M50 96 V70" stroke="#94BDFF" />
          <path d="M360 96 V70" stroke="#94BDFF" />
          <rect x="78" y="40" width="46" height="30" rx="6" stroke="#5797FF" />
          <path d="M90 55 H112" stroke="#5797FF" />
          <path d="M150 68 C150 58 158 52 166 52 C174 52 182 58 182 68" stroke="#5797FF" />
          <path d="M166 52 V46" stroke="#5797FF" />
          <path d="M216 44 H276 V68 H216 Z" stroke="#5797FF" />
          <path d="M226 54 H266" stroke="#5797FF" />
          <path d="M226 61 H254" stroke="#5797FF" />
          <path d="M310 46 C318 52 322 60 320 68" stroke="#5797FF" />

          <path d="M86 240 V330" stroke="#BDD6FF" />
          <path d="M86 330 H336 V240 H86 Z" />
          <path d="M86 240 H336 V258 H86 Z" />
          <circle cx="118" cy="288" r="14" />
          <path d="M118 274 V266" />
          <path d="M112 296 L124 280" />
          <rect x="162" y="274" width="58" height="44" rx="6" />
          <path d="M174 286 H208" />
          <path d="M174 296 H196" />
          <rect x="248" y="272" width="60" height="46" rx="6" />
          <circle cx="278" cy="295" r="9" stroke="#0048BB" />
          <path d="M150 318 H168 V330" />
          <path d="M226 318 H244 V330" />
          <circle cx="159" cy="326" r="7" stroke="#5797FF" />
          <path d="M156 326 H162" stroke="#5797FF" />

          <path d="M50 358 H672" strokeWidth={2} />
          <path d="M74 358 V474" />
          <path d="M648 358 V474" />
          <path d="M74 474 H648" />
          <path d="M74 402 H648" stroke="#BDD6FF" />
          <path d="M362 402 V474" stroke="#BDD6FF" />
          <path d="M504 402 V474" stroke="#BDD6FF" />
          <path d="M96 426 H340" stroke="#94BDFF" />
          <path d="M386 440 H480" stroke="#94BDFF" />
          <path d="M528 440 H624" stroke="#94BDFF" />

          <path d="M336 358 V316" />
          <path d="M448 358 V316" />
          <path d="M336 316 H448" />
          <ellipse cx="392" cy="316" rx="42" ry="7" />
          <path d="M362 316 L367 274 H417 L422 316" />
          <path d="M367 274 C367 268 373 264 380 264 H404 C411 264 417 268 417 274" />
          <path d="M417 280 C427 280 431 286 429 293 C427 299 421 302 415 302" />

          <ellipse cx="524" cy="346" rx="52" ry="10" stroke="#5797FF" />
          <path d="M484 342 C484 331 492 323 502 323 C510 323 516 327 519 333 C523 326 531 321 539 323 C549 325 555 333 553 342" />
          <path d="M506 325 C507 329 507 333 506 336" />
          <path d="M535 325 C533 329 532 333 532 337" />

          <ellipse cx="600" cy="350" rx="34" ry="7" stroke="#94BDFF" />
          <ellipse cx="592" cy="344" rx="7" ry="10" transform="rotate(-30 592 344)" stroke="#5797FF" />
          <ellipse cx="610" cy="345" rx="6.5" ry="9.5" transform="rotate(24 610 345)" stroke="#5797FF" />
          <path d="M590 337 C591.5 341 593 345 594 349" stroke="#5797FF" />

          <path d="M116 358 V344 H156 V358" stroke="#94BDFF" />
          <path d="M126 344 C126 334 132 328 136 328 C140 328 146 334 146 344" stroke="#5797FF" />
          <path d="M136 328 V321" stroke="#5797FF" />
          <path d="M136 321 C133 316 128 314 126 308" stroke="#0048BB" />
          <path d="M136 321 C139 315 144 313 147 308" stroke="#0048BB" />
          <path d="M136 318 C136 312 136 307 136 302" stroke="#0048BB" />

          <path d="M40 474 H680" stroke="#BDD6FF" strokeDasharray="2 10" />
          <circle cx="452" cy="60" r="4" fill="#0048BB" stroke="none" />
          <circle cx="440" cy="96" r="2.5" fill="#5797FF" stroke="none" />
          <circle cx="470" cy="240" r="3" fill="#5797FF" stroke="none" />
          <circle cx="300" cy="180" r="2.5" fill="#94BDFF" stroke="none" />
          <circle cx="672" cy="300" r="3.5" fill="#0048BB" stroke="none" />
          <path d="M240 452 C246 446 256 446 262 452" stroke="#94BDFF" />
          <path d="M470 444 C476 438 486 438 492 444" stroke="#94BDFF" />
        </>,
        { i: 0 },
        0.12,
        0.014
      )}</g>

      <g className="animate-steam" style={{ animationDelay: '0.4s' }}>
        <path d="M159 314 C159 309 163 307 163 302" stroke="#5797FF" />
      </g>
      <g className="animate-steam" style={{ animationDelay: '1.4s' }}>
        <path d="M166 316 C166 311 170 309 170 304" stroke="#5797FF" />
      </g>
      <g className="animate-steam">
        <path d="M382 254 C382 247 388 244 388 237" stroke="#0048BB" />
      </g>
      <g className="animate-steam" style={{ animationDelay: '1s' }}>
        <path d="M397 256 C397 249 403 246 403 239" stroke="#0048BB" />
      </g>
      <g className="animate-steam" style={{ animationDelay: '1.9s' }}>
        <path d="M411 254 C411 247 417 244 417 237" stroke="#0048BB" />
      </g>
    </svg>
  );
});

export {
  EMPTY_ART,
  CupGlyph,
  CroissantGlyph,
  BeansGlyph,
  TeapotGlyph,
  PastryGlyph,
  CutleryGlyph,
  ReceiptGlyph,
  TrayGlyph,
  LineCupLoader,
  SteamCurls,
  LinkedLineBand,
  CafeHeroScene,
};
