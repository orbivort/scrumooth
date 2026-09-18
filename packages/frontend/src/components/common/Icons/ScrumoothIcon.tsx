import React from 'react';

interface IconProps {
  size?: number;
  /** Draw the dark rounded plate inside the SVG (self-contained app-icon look). */
  plate?: boolean;
  className?: string;
}

/**
 * Scrumooth brand mark — three integrated elements, each carrying one idea:
 *
 *   1. Orbit      — the sprint cycle that wraps the workflow: a closed ring, so
 *                   the mark still reads as a badge at favicon scale.
 *   2. Flow (S)   — the Scrumooth letterform: Scrum + Smooth. Two balanced lobes
 *                   crossing the exact centre of the canvas.
 *   3. Gate node  — a real knockout at the flow's midpoint. The S is cut by a
 *                   transparent gate and the sprint heartbeat sits inside it.
 *                   "The gatekeeper, not the note-taker", in one gesture.
 *
 * The gate is an SVG mask, so the cut is genuinely transparent: the mark is
 * correct on light and dark surfaces and never depends on a background plate.
 *
 * Designed for versatile placement: login hero (100px+), sidebar header (40px),
 * page titles, and favicon-scale reproduction (16–32px).
 */
export const ScrumoothIcon: React.FC<IconProps> = ({
  size = 40,
  plate = false,
  className,
  ...props
}) => {
  const uid = React.useId().replace(/:/g, '');

  const flowGradId = `${uid}-flow`;
  const gateGradId = `${uid}-gate`;
  const plateGradId = `${uid}-plate`;
  const cutMaskId = `${uid}-cut`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <defs>
        <linearGradient
          id={flowGradId}
          x1="14"
          y1="10"
          x2="86"
          y2="90"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>

        <linearGradient
          id={gateGradId}
          x1="50"
          y1="45"
          x2="50"
          y2="55"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#A5F3FC" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>

        {plate && (
          <linearGradient
            id={plateGradId}
            x1="0"
            y1="0"
            x2="100"
            y2="100"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#131c31" />
            <stop offset="60%" stopColor="#101731" />
            <stop offset="100%" stopColor="#1c1745" />
          </linearGradient>
        )}

        {/* Knockout that severs the flow at the gate. White keeps, black cuts. */}
        <mask
          id={cutMaskId}
          maskUnits="userSpaceOnUse"
          mask-type="luminance"
          x="0"
          y="0"
          width="100"
          height="100"
        >
          <rect width="100" height="100" fill="#ffffff" />
          <circle cx="50" cy="50" r="7.4" fill="#000000" />
        </mask>
      </defs>

      {plate && (
        <>
          <rect width="100" height="100" rx="26" fill={`url(#${plateGradId})`} />
          <rect
            x="0.75"
            y="0.75"
            width="98.5"
            height="98.5"
            rx="25.25"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.1"
            strokeWidth="1.5"
          />
        </>
      )}

      <g transform={plate ? 'translate(50 50) scale(0.9) translate(-50 -50)' : undefined}>
        {/* Orbit — the sprint cycle */}
        <circle
          cx="50"
          cy="50"
          r="41"
          stroke={`url(#${flowGradId})`}
          strokeWidth="3.4"
          opacity="0.8"
        />

        {/* Flow — the Scrumooth S, gated at its midpoint */}
        <path
          d="M 65.36 32.72 C 65.36 23.12 34.64 23.12 34.64 35.6 C 34.64 47.6 65.36 52.4 65.36 64.4 C 65.36 76.88 34.64 76.88 34.64 67.28"
          stroke={`url(#${flowGradId})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          mask={`url(#${cutMaskId})`}
        />

        {/* Gate node — the checkpoint the flow passes through */}
        <circle cx="50" cy="50" r="4.9" fill={`url(#${gateGradId})`} />
      </g>
    </svg>
  );
};
