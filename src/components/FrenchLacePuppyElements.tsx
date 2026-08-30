import React from 'react';

export function FlowerLacePattern({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none select-none ${className}`}
      viewBox="0 0 240 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Decorative Scalloped Lace Edges with Flowers */}
      <path
        d="M0 12 C10 4, 20 4, 30 12 C40 20, 50 20, 60 12 C70 4, 80 4, 90 12 C100 20, 110 20, 120 12 C130 4, 140 4, 150 12 C160 20, 170 20, 180 12 C190 4, 200 4, 210 12 C220 20, 230 20, 240 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="2 3"
        opacity="0.6"
      />
      {/* Tiny Florets */}
      <g opacity="0.75" fill="currentColor">
        <circle cx="30" cy="12" r="2" />
        <circle cx="90" cy="12" r="2" />
        <circle cx="150" cy="12" r="2" />
        <circle cx="210" cy="12" r="2" />
        {/* Flower Petals */}
        <circle cx="30" cy="9" r="1" opacity="0.5" />
        <circle cx="30" cy="15" r="1" opacity="0.5" />
        <circle cx="27" cy="12" r="1" opacity="0.5" />
        <circle cx="33" cy="12" r="1" opacity="0.5" />
        
        <circle cx="150" cy="9" r="1" opacity="0.5" />
        <circle cx="150" cy="15" r="1" opacity="0.5" />
        <circle cx="147" cy="12" r="1" opacity="0.5" />
        <circle cx="153" cy="12" r="1" opacity="0.5" />
      </g>
    </svg>
  );
}

export function FrenchCornerLace({ className = '', position = 'top-left' }: { className?: string; position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
  const rotation = {
    'top-left': '',
    'top-right': 'scale-x-[-1]',
    'bottom-left': 'scale-y-[-1]',
    'bottom-right': 'scale-[-1]',
  }[position];

  return (
    <svg
      className={`pointer-events-none select-none w-10 h-10 ${rotation} ${className}`}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2 2 H28 C28 16, 16 28, 2 28 V2 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 2"
        fill="currentColor"
        fillOpacity="0.04"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.5" />
      <path
        d="M6 6 C16 10, 10 16, 6 6"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx="22" cy="6" r="1.5" fill="currentColor" fillOpacity="0.7" />
      <circle cx="6" cy="22" r="1.5" fill="currentColor" fillOpacity="0.7" />
      <circle cx="2" cy="2" r="2" fill="currentColor" />
    </svg>
  );
}

export function LinePuppyMascot({
  variant = 'happy',
  className = '',
  size = 40,
}: {
  variant?: 'happy' | 'snuggle' | 'sparkle' | 'sleep' | 'peek';
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none inline-block transition-transform duration-300 ${className}`}
      aria-label="线条小狗"
    >
      {/* Fluffy Outline of Puppy Head */}
      <path
        d="M 30 45 C 20 28, 12 40, 22 58 C 18 68, 25 80, 42 82 C 55 83, 72 82, 78 72 C 86 58, 82 45, 74 44 C 84 26, 75 22, 65 38 C 55 33, 45 33, 30 45 Z"
        fill="#FFFFFF"
        stroke="#4A3E3D"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Floppy Left Ear with Rosy Tint */}
      <path
        d="M 22 36 C 14 42, 14 55, 24 58"
        stroke="#4A3E3D"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Floppy Right Ear */}
      <path
        d="M 74 36 C 84 42, 84 55, 74 58"
        stroke="#4A3E3D"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Sweet Eyes */}
      {variant === 'happy' || variant === 'sparkle' ? (
        <>
          {/* Beady Happy Eyes with Glimmer */}
          <ellipse cx="38" cy="56" rx="4" ry="4.5" fill="#4A3E3D" />
          <circle cx="36.5" cy="54.5" r="1.5" fill="#FFFFFF" />
          <ellipse cx="62" cy="56" rx="4" ry="4.5" fill="#4A3E3D" />
          <circle cx="60.5" cy="54.5" r="1.5" fill="#FFFFFF" />
        </>
      ) : variant === 'sleep' ? (
        <>
          {/* Contented Sleeping Arcs */}
          <path d="M 34 57 Q 38 61 42 57" stroke="#4A3E3D" strokeWidth="3" strokeLinecap="round" />
          <path d="M 58 57 Q 62 61 66 57" stroke="#4A3E3D" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* Peeking Curled Eyes ^_^ */}
          <path d="M 34 57 Q 38 52 42 57" stroke="#4A3E3D" strokeWidth="3" strokeLinecap="round" />
          <path d="M 58 57 Q 62 52 66 57" stroke="#4A3E3D" strokeWidth="3" strokeLinecap="round" />
        </>
      )}

      {/* Cute Puppy Button Nose */}
      <ellipse cx="50" cy="62" rx="3.5" ry="2.8" fill="#4A3E3D" />

      {/* W-Shaped Gentle Puppy Mouth */}
      <path
        d="M 45 66 Q 50 69 50 65 Q 50 69 55 66"
        stroke="#4A3E3D"
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* Soft Rosy Cheeks (Blush) */}
      <circle cx="28" cy="62" r="5" fill="#FFB4C2" fillOpacity="0.75" />
      <circle cx="72" cy="62" r="5" fill="#FFB4C2" fillOpacity="0.75" />

      {/* Little French Beret or Daisy Flower Accessory */}
      <g transform="translate(56, 22) rotate(12)">
        <circle cx="10" cy="10" r="5" fill="#FFD1DC" stroke="#4A3E3D" strokeWidth="2" />
        <circle cx="10" cy="10" r="2" fill="#FEE440" />
        {/* Flower Petals */}
        <circle cx="10" cy="4" r="2.5" fill="#FFFFFF" stroke="#4A3E3D" strokeWidth="1.5" />
        <circle cx="16" cy="10" r="2.5" fill="#FFFFFF" stroke="#4A3E3D" strokeWidth="1.5" />
        <circle cx="10" cy="16" r="2.5" fill="#FFFFFF" stroke="#4A3E3D" strokeWidth="1.5" />
        <circle cx="4" cy="10" r="2.5" fill="#FFFFFF" stroke="#4A3E3D" strokeWidth="1.5" />
      </g>

      {/* Sparkles around puppy if requested */}
      {variant === 'sparkle' && (
        <g fill="#FFB703" stroke="#4A3E3D" strokeWidth="1">
          <path d="M 12 28 L 14 34 L 20 36 L 14 38 L 12 44 L 10 38 L 4 36 L 10 34 Z" fill="#FEE440" />
          <path d="M 82 22 L 83 26 L 87 27 L 83 28 L 82 32 L 81 28 L 77 27 L 81 26 Z" fill="#FFB4C2" />
        </g>
      )}
    </svg>
  );
}

export function ClockRollbackIcon({
  className = '',
  size = 16,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none shrink-0 inline-block ${className}`}
      aria-label="回溯"
    >
      {/* Counterclockwise arc path starting from ~bottom left, around top right to ~9 o'clock */}
      <path
        d="M 26 77 A 40 40 0 1 0 14 47.5"
        stroke="currentColor"
        strokeWidth="11"
        strokeLinecap="round"
      />
      {/* Downward triangle arrowhead at 9 o'clock */}
      <path
        d="M 1 43 L 26 43 L 13.5 61 Z"
        fill="currentColor"
      />
      {/* L-shaped clock hands (12:00 and 3:00) */}
      <path
        d="M 50 24 L 50 50 L 76 50"
        stroke="currentColor"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KittyBowDoodle({
  className = '',
  size = 24,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none inline-block shrink-0 ${className}`}
      aria-label="蝴蝶结猫猫"
    >
      {/* White Body Base */}
      <path
        d="M 33 40 C 26 48, 25 72, 42 75 C 58 76, 74 76, 80 72 C 86 64, 85 48, 77 42 C 70 38, 40 37, 33 40 Z"
        fill="#FFFFFF"
      />

      {/* Top Left Star / Sparkle Cluster */}
      <g stroke="#1F1D1D" strokeWidth="2.8" strokeLinecap="round">
        <line x1="22" y1="18" x2="22" y2="24" />
        <line x1="19" y1="21" x2="25" y2="21" />
        <circle cx="27" cy="17" r="1" fill="#1F1D1D" />
        <circle cx="17" cy="25" r="1" fill="#1F1D1D" />
      </g>

      {/* Kitty Face Outline (Hand-drawn sketchy style) */}
      {/* Left Ear */}
      <path
        d="M 34 52 C 32 44, 34 38, 38 34 C 43 30, 48 37, 52 38"
        stroke="#1F1D1D"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      {/* Head Top / Right Ear Base */}
      <path
        d="M 52 38 C 55 37, 59 36, 62 36"
        stroke="#1F1D1D"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      {/* Right Ear */}
      <path
        d="M 64 36 C 68 33, 74 34, 76 40"
        stroke="#1F1D1D"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      {/* Left Cheek */}
      <path
        d="M 33 55 C 31 62, 33 69, 39 74"
        stroke="#1F1D1D"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      {/* Bottom Chin */}
      <path
        d="M 40 74 C 50 76, 65 76, 75 73"
        stroke="#1F1D1D"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      {/* Right Cheek */}
      <path
        d="M 76 73 C 82 68, 83 60, 81 53"
        stroke="#1F1D1D"
        strokeWidth="4.2"
        strokeLinecap="round"
      />

      {/* Rosy Blushing Cheeks */}
      <ellipse cx="40" cy="65" rx="5.5" ry="4" fill="#FFCCD5" />
      <ellipse cx="73" cy="65" rx="5.5" ry="4" fill="#FFCCD5" />

      {/* Eyes & Whiskers on Cheeks */}
      {/* Left Eye & Whisker Dash */}
      <line x1="37" y1="63" x2="41" y2="63" stroke="#1F1D1D" strokeWidth="3" strokeLinecap="round" />
      <line x1="37" y1="67" x2="41" y2="67" stroke="#1F1D1D" strokeWidth="3" strokeLinecap="round" />
      <line x1="44" y1="64" x2="47" y2="63" stroke="#1F1D1D" strokeWidth="3" strokeLinecap="round" />

      {/* Right Eye & Whisker Dash */}
      <line x1="68" y1="64" x2="71" y2="64" stroke="#1F1D1D" strokeWidth="3" strokeLinecap="round" />
      <line x1="72" y1="67" x2="76" y2="67" stroke="#1F1D1D" strokeWidth="3" strokeLinecap="round" />
      <line x1="73" y1="63" x2="77" y2="63" stroke="#1F1D1D" strokeWidth="3" strokeLinecap="round" />

      {/* Yellow Nose Dot */}
      <circle cx="56" cy="64" r="2.2" fill="#F4C430" />

      {/* Big Cute Red Bow (Angled on right ear) */}
      <g transform="translate(68, 47) rotate(22)">
        {/* Left Bow Loop */}
        <path
          d="M -1 -2 C -7 -10, -16 -6, -14 3 C -13 9, -5 6, 0 1 Z"
          fill="#EF475B"
          stroke="#1F1D1D"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        {/* Right Bow Loop */}
        <path
          d="M 1 -2 C 7 -10, 16 -6, 14 3 C 13 9, 5 6, 0 1 Z"
          fill="#EF475B"
          stroke="#1F1D1D"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        {/* Center Knot */}
        <ellipse
          cx="0"
          cy="0"
          rx="3.5"
          ry="4"
          fill="#E02F44"
          stroke="#1F1D1D"
          strokeWidth="3"
        />
      </g>
    </svg>
  );
}

export function ScarfBunnyDoodle({
  className = '',
  size = 24,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none inline-block shrink-0 ${className}`}
      aria-label="围巾小兔"
    >
      <defs>
        {/* Charcoal crayon texture for authentic hand-drawn picture-book feel */}
        <filter id="scarf-bunny-crayon" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.9" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <g filter="url(#scarf-bunny-crayon)">
        {/* White Bunny Head & Ears Base */}
        <path
          d="M 33 63
             C 26 60, 24 54, 26 48
             C 28 42, 32 37, 34 31
             C 35 23, 36 15, 41 12
             C 46 9, 49 14, 49 22
             C 49 29, 50 35, 51 37
             C 52 35, 53 29, 53 22
             C 53 14, 56 9, 61 12
             C 66 15, 67 23, 68 31
             C 70 37, 74 42, 76 48
             C 78 54, 76 60, 69 63
             Z"
          fill="#FFFFFF"
        />

        {/* Soft Pink Inner Ears */}
        <path
          d="M 41 18 C 38 18, 38 31, 41 31 C 44 31, 44 18, 41 18 Z"
          fill="#F8B4C0"
        />
        <path
          d="M 61 18 C 58 18, 58 31, 61 31 C 64 31, 64 18, 61 18 Z"
          fill="#F8B4C0"
        />

        {/* Soft Pink Crayon Blush */}
        <rect
          x="27.5"
          y="55.5"
          width="9.5"
          height="4.5"
          rx="2.2"
          fill="#F7A0AF"
          opacity="0.95"
        />
        <rect
          x="64.5"
          y="55.5"
          width="9.5"
          height="4.5"
          rx="2.2"
          fill="#F7A0AF"
          opacity="0.95"
        />

        {/* Vertical Charcoal Oval Eyes */}
        <ellipse cx="43" cy="56" rx="2" ry="3.2" fill="#1C1B1B" />
        <ellipse cx="58" cy="56" rx="2" ry="3.2" fill="#1C1B1B" />

        {/* Charcoal Crayon Outline of Head & Ears */}
        <path
          d="M 33 63
             C 26 60, 24 54, 26 48
             C 28 42, 32 37, 34 31
             C 35 23, 36 15, 41 12
             C 46 9, 49 14, 49 22
             C 49 29, 50 35, 51 37
             C 52 35, 53 29, 53 22
             C 53 14, 56 9, 61 12
             C 66 15, 67 23, 68 31
             C 70 37, 74 42, 76 48
             C 78 54, 76 60, 69 63"
          stroke="#1E1E1E"
          strokeWidth="4.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Red Wool Scarf */}
        {/* Scarf Left Hanging Tail */}
        <path
          d="M 30 67
             C 30 73, 29 80, 31 84
             C 32 86, 38 86, 40 82
             C 41 78, 41 72, 40 68
             Z"
          fill="#B83D4A"
        />
        {/* Scarf Main Horizontal Collar Wrap */}
        <path
          d="M 28 66
             C 26 62, 29 60, 36 60
             C 46 61, 56 61, 65 60
             C 72 60, 75 62, 74 66
             C 73 70, 69 72, 62 72
             C 52 73, 41 73, 31 72
             C 27 71, 27 68, 28 66
             Z"
          fill="#B83D4A"
        />
      </g>
    </svg>
  );
}

// Export PuppyHeartsDoodle as alias to ensure seamless backward-compatibility
export const PuppyHeartsDoodle = ScarfBunnyDoodle;

export function LinePuppyDoodle({
  className = '',
  size = 24,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none inline-block shrink-0 ${className}`}
      aria-label="线条小狗"
    >
      {/* Body background white */}
      <path
        d="M 28 85 C 28 87, 40 88, 43 85 C 46 80, 54 80, 57 85 C 60 88, 72 87, 72 85 C 76 66, 75 58, 83 50 C 88 42, 85 36, 75 35 C 78 20, 68 18, 62 25 C 56 20, 44 20, 38 25 C 32 18, 22 20, 25 35 C 15 36, 12 42, 17 50 C 25 58, 24 66, 28 85 Z"
        fill="#FFFFFF"
      />
      {/* Hand-drawn Wavy Ears and Head Top Outline */}
      <path
        d="M 22 34 C 20 28, 25 21, 33 24 C 36 26, 37 30, 36 34"
        stroke="#221E1F"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M 38 24 C 41 21, 46 21, 48 24 M 52 24 C 55 21, 60 21, 63 24"
        stroke="#221E1F"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M 64 34 C 63 30, 64 26, 67 24 C 75 21, 80 28, 78 34"
        stroke="#221E1F"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Left Raised Arm & Body Contour */}
      <path
        d="M 22 35 C 19 40, 18 43, 20 46 C 22 49, 26 49, 27 46"
        stroke="#221E1F"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M 27 46 C 26 52, 21 54, 18 53 C 16 50, 16 46, 18 43"
        stroke="#221E1F"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M 21 56 C 23 58, 27 58, 28 55 C 29 65, 31 75, 33 83"
        stroke="#221E1F"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Right Raised Arm & Body Contour */}
      <path
        d="M 78 35 C 81 40, 82 43, 80 46 C 78 49, 74 49, 73 46"
        stroke="#221E1F"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M 73 46 C 74 52, 79 54, 82 53 C 84 50, 84 46, 82 43"
        stroke="#221E1F"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M 79 56 C 77 58, 73 58, 72 55 C 71 65, 69 75, 67 83"
        stroke="#221E1F"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Bottom Feet and In-between Wavy Arc */}
      <path
        d="M 33 84 C 36 86, 40 85, 42 83"
        stroke="#221E1F"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M 46 82 C 49 76, 51 76, 54 82"
        stroke="#221E1F"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M 58 83 C 60 85, 64 86, 67 84"
        stroke="#221E1F"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Cute Dot Eyes */}
      <circle cx="41" cy="37" r="3.2" fill="#221E1F" />
      <circle cx="59" cy="37" r="3.2" fill="#221E1F" />

      {/* Button Nose & Cheerful Open Tongue */}
      <ellipse cx="50" cy="36" rx="3.5" ry="2.8" fill="#221E1F" />
      {/* Tongue Base */}
      <path
        d="M 45 40 Q 50 42 55 40"
        stroke="#221E1F"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Sticking Out Pink Tongue U */}
      <path
        d="M 46 41 C 46 47, 54 47, 54 41 Z"
        fill="#F37E88"
        stroke="#221E1F"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StardewPixelFlower({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center pixel-emboss ${className}`} aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Pixel Camellia / Daisy */}
        <rect x="7" y="7" width="2" height="2" fill="#FFD166" />
        <rect x="5" y="7" width="2" height="2" fill="#FF9EAA" />
        <rect x="9" y="7" width="2" height="2" fill="#FF9EAA" />
        <rect x="7" y="5" width="2" height="2" fill="#FF9EAA" />
        <rect x="7" y="9" width="2" height="2" fill="#FF9EAA" />
        {/* Leaf */}
        <rect x="11" y="11" width="2" height="2" fill="#84DCC6" />
        <rect x="3" y="11" width="2" height="2" fill="#84DCC6" />
      </svg>
    </span>
  );
}

/**
 * 3D Clay Cloud Thought Bubble matching user Image 3:
 * Pure white glossy puffy cloud with soft 3D clay relief,
 * multi-lobed contour, and 3 descending trailing thought spheres at bottom-left.
 */
export function Puffy3DCloudThoughtBubble({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative inline-block max-w-full my-2.5 select-text pl-4 pr-1 pb-3 ${className}`}>
      {/* Main 3D Puffy Cloud Container */}
      <div
        className="relative z-10 px-4 py-2.5 rounded-[26px] bg-gradient-to-b from-[#ffffff] via-[#fcfdff] to-[#edf1f5] border border-white/80 transition-transform"
        style={{
          boxShadow: `
            0 8px 24px -4px rgba(0, 0, 0, 0.08),
            0 2px 8px rgba(0, 0, 0, 0.04),
            inset 0 2px 4px rgba(255, 255, 255, 0.95),
            inset 0 -3px 6px rgba(180, 195, 210, 0.28),
            inset 2px 0 4px rgba(255, 255, 255, 0.8),
            inset -2px 0 4px rgba(180, 195, 210, 0.2)
          `,
        }}
      >
        {/* Scalloped / Puffy Cloud Top & Side Lobes (Clay Bulges) */}
        {/* Top Lobes */}
        <span
          className="absolute -top-2 left-6 w-7 h-4 rounded-full bg-gradient-to-t from-[#ffffff] to-[#ffffff] pointer-events-none"
          style={{
            boxShadow: '0 -2px 5px rgba(0,0,0,0.03), inset 0 2px 3px rgba(255,255,255,1)',
          }}
        />
        <span
          className="absolute -top-2.5 left-14 w-9 h-5 rounded-full bg-gradient-to-t from-[#ffffff] to-[#ffffff] pointer-events-none"
          style={{
            boxShadow: '0 -2px 5px rgba(0,0,0,0.03), inset 0 2px 3px rgba(255,255,255,1)',
          }}
        />
        <span
          className="absolute -top-2 right-8 w-8 h-4 rounded-full bg-gradient-to-t from-[#ffffff] to-[#ffffff] pointer-events-none"
          style={{
            boxShadow: '0 -2px 5px rgba(0,0,0,0.03), inset 0 2px 3px rgba(255,255,255,1)',
          }}
        />

        {/* Bottom Lobes */}
        <span
          className="absolute -bottom-1.5 left-10 w-8 h-3.5 rounded-full bg-gradient-to-b from-[#f5f8fb] to-[#e4eaf0] pointer-events-none"
          style={{
            boxShadow: '0 3px 5px rgba(0,0,0,0.05), inset 0 -2px 3px rgba(180,195,210,0.3)',
          }}
        />
        <span
          className="absolute -bottom-1.5 right-12 w-8 h-3.5 rounded-full bg-gradient-to-b from-[#f5f8fb] to-[#e4eaf0] pointer-events-none"
          style={{
            boxShadow: '0 3px 5px rgba(0,0,0,0.05), inset 0 -2px 3px rgba(180,195,210,0.3)',
          }}
        />

        {/* Content */}
        <div className="relative z-20 flex items-baseline gap-1.5">
          {children}
        </div>
      </div>

      {/* Trailing 3D Thought Cloud Bubbles at Bottom-Left */}
      {/* 1. Large Sphere (closest to cloud) */}
      <div
        className="absolute bottom-1 left-2.5 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-[#ffffff] via-[#f7f9fb] to-[#d8e0e9] border border-white/80 pointer-events-none"
        style={{
          boxShadow: '0 3px 6px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,1), inset 0 -1.5px 2px rgba(160,175,190,0.4)',
        }}
      />
      {/* 2. Medium Sphere */}
      <div
        className="absolute -bottom-1 left-0.5 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#ffffff] via-[#f7f9fb] to-[#d8e0e9] border border-white/80 pointer-events-none"
        style={{
          boxShadow: '0 2px 4px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255,255,255,1), inset 0 -1px 1.5px rgba(160,175,190,0.4)',
        }}
      />
      {/* 3. Small Sphere (tip) */}
      <div
        className="absolute -bottom-2.5 -left-1 w-1.5 h-1.5 rounded-full bg-gradient-to-br from-[#ffffff] via-[#f7f9fb] to-[#d8e0e9] border border-white/80 pointer-events-none"
        style={{
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), inset 0 0.5px 1px rgba(255,255,255,1)',
        }}
      />
    </div>
  );
}

/**
 * CuteWavyFaceIcon: Minimalist kawaii sleepy/relaxed face with wavy omega/cat mouth
 * Matches the user-provided reference illustration:
 * - Two downward-sloping, arched thick rounded eye bars
 * - Center smooth wavy kitten/omega mouth
 */
export function CuteWavyFaceIcon({
  className = '',
  size = 20,
  width,
  height,
  color = 'currentColor',
}: {
  className?: string;
  size?: number;
  width?: number | string;
  height?: number | string;
  color?: string;
}) {
  return (
    <svg
      width={width ?? size}
      height={height ?? size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none inline-block shrink-0 ${className}`}
      aria-label="可爱波浪嘴表情"
    >
      {/* Left Eye: Downward slanted, gently arched thick capsule */}
      <path
        d="M 10 52 C 16.5 44.5, 24 43.8, 31 47"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Right Eye: Symmetric mirror of left eye */}
      <path
        d="M 90 52 C 83.5 44.5, 76 43.8, 69 47"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Center Mouth: Wavy cute cat/omega mouth curve */}
      <path
        d="M 38 53.6 C 39.5 55.8, 41.2 57.2, 43.2 57.2 C 45.8 57.2, 47.6 50.3, 50 50.3 C 52.4 50.3, 54.2 57.2, 56.8 57.2 C 58.8 57.2, 60.5 55.8, 62 53.6"
        stroke={color}
        strokeWidth="5.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * CuteBlueFishIcon: Adorable hand-drawn pastel blue fish doodle
 * Matches the user-provided reference illustration:
 * - Chubby oval body with soft pastel baby blue fill (#9EC4E8)
 * - Bold charcoal outline with smooth rounded corners (#363236)
 * - Distinct tail fin with upper and lower waist indents
 * - Cute solid charcoal dot eye
 */
export function CuteBlueFishIcon({
  className = '',
  size = 20,
  width,
  height,
  fillColor = '#9EC4E8',
  strokeColor = '#363236',
}: {
  className?: string;
  size?: number;
  width?: number | string;
  height?: number | string;
  fillColor?: string;
  strokeColor?: string;
}) {
  return (
    <svg
      width={width ?? size}
      height={height ?? size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none inline-block shrink-0 ${className}`}
      aria-label="可爱小蓝鱼"
    >
      {/* Blue fish body with bold outline and tail fin */}
      <path
        d="M 15 50
           C 15 32, 28 24, 47 24
           C 60 24, 67 30, 71 36
           C 74 34, 79 31, 84 32
           C 87 36, 87 54, 84 58
           C 79 59, 74 57, 71 55
           C 67 61, 60 67, 47 67
           C 28 67, 15 62, 15 50
           Z"
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dark charcoal round eye */}
      <circle cx="33" cy="48" r="4.3" fill={strokeColor} />
    </svg>
  );
}


