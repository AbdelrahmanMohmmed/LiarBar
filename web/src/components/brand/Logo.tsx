import { BRAND } from "@/lib/brand";
import { useLanguage } from "@/lib/languageContext";

/**
 * The brand mark: dots in a ring with one gap.
 *
 * The gap is the empty seat — the whole pitch of the product is "send the
 * link, there's a seat". Drawn as SVG rather than shipped as a raster so it
 * inherits the theme tokens, stays sharp at every density, costs no request,
 * and needs no separate RTL asset (a ring is mirror-safe).
 *
 * Raster exports for OG images / app icons / social avatars are specified in
 * docs/IMAGE_BRIEFS.md — those are the only places a PNG is actually needed.
 */

interface MarkProps {
  size?: number;
  className?: string;
  /** Animate the gap dot filling in. Used once on the landing hero. */
  animated?: boolean;
}

export function LogoMark({ size = 32, className = "", animated = false }: MarkProps) {
  // Seven of eight positions around a circle are filled; the eighth (the
  // upper-right, at -45°) is left open.
  const positions = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    // Start just past the gap and walk clockwise.
    const angle = (-45 + 45 * (i + 1)) * (Math.PI / 180);
    return {
      cx: 24 + 15 * Math.cos(angle),
      cy: 24 + 15 * Math.sin(angle),
    };
  });
  const gapAngle = -45 * (Math.PI / 180);
  const gap = { cx: 24 + 15 * Math.cos(gapAngle), cy: 24 + 15 * Math.sin(gapAngle) };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label={`${BRAND.name} logo`}
    >
      {positions.map((p, i) => (
        <circle
          key={i}
          cx={p.cx}
          cy={p.cy}
          r={4.6}
          fill="hsl(var(--coral))"
          opacity={1 - i * 0.055}
        />
      ))}
      {/* The open seat. Outlined, not filled — it's a space, not a person. */}
      <circle
        cx={gap.cx}
        cy={gap.cy}
        r={4.6}
        fill="none"
        stroke="hsl(var(--mint))"
        strokeWidth={1.8}
        strokeDasharray={animated ? "3 3" : undefined}
        opacity={0.9}
      >
        {animated && (
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="12"
            dur="1.6s"
            repeatCount="indefinite"
          />
        )}
      </circle>
    </svg>
  );
}

interface LogoProps {
  size?: number;
  /** Hide the wordmark and render the mark alone. */
  markOnly?: boolean;
  className?: string;
  animated?: boolean;
}

export function Logo({ size = 32, markOnly = false, className = "", animated = false }: LogoProps) {
  const { lang } = useLanguage();
  const wordmark = lang === "ar" ? BRAND.nameAr : BRAND.name;

  if (markOnly) return <LogoMark size={size} className={className} animated={animated} />;

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} animated={animated} />
      <span
        className="font-display leading-none text-cream"
        style={{ fontSize: size * 0.72 }}
      >
        {wordmark}
      </span>
    </span>
  );
}

export default Logo;
