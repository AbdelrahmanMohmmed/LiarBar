import type { CSSProperties, ReactNode } from "react";
import { COLORS, BUTTON_FONT } from "./theme";

/**
 * Legacy primitives, restyled onto the design system.
 *
 * Same components, same props, same call sites — see the note at the top of
 * `theme.ts` for why the values moved rather than the markup. The shapes are
 * updated to match the current system too: the 3px outline and 6px hard offset
 * shadow were part of the old neo-brutalist look and read as a completely
 * different product next to anything built since.
 *
 * New work should use the token classes (`.btn`, `.field`, `.surface`) from
 * `index.css` directly, or `components/game/GameSetupPage.tsx` for a setup
 * screen. These exist so the five pages still on the old system land on the
 * right palette without being rewritten.
 */

export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: COLORS.white,
        borderRadius: 20,
        border: "1px solid rgba(245, 237, 226, 0.12)",
        // Soft elevation instead of the old hard offset shadow — see
        // docs/DESIGN_SYSTEM.md §3 on why shadows here are warm, not black.
        boxShadow: "0 2px 4px rgba(0,0,0,.35), 0 20px 48px -12px rgba(0,0,0,.7)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
  align = "left",
}: {
  label: string;
  children: ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 13,
          color: COLORS.textSecondary,
          marginBottom: 6,
          textAlign: align,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function inputStyle(align: "left" | "right" | "center" = "left"): CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(245, 237, 226, 0.16)",
    background: "rgba(0,0,0,.28)",
    color: COLORS.ink,
    // 16px, not 15: iOS Safari zooms the viewport on focus for anything
    // smaller, which throws the player out of the layout mid-game.
    fontSize: 16,
    textAlign: align,
    outline: "none",
  };
}

export function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        fontFamily: BUTTON_FONT,
        fontWeight: 700,
        fontSize: 14,
        // 44px minimum: below that a thumb misses, and a missed tap in a
        // turn-based game costs a turn.
        minHeight: 44,
        padding: "0 12px",
        borderRadius: 999,
        border: active ? "none" : "1px solid rgba(245, 237, 226, 0.18)",
        background: active ? COLORS.red : "rgba(245, 237, 226, 0.06)",
        color: active ? COLORS.trueWhite : COLORS.ink,
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function PillToggle({
  active,
  onClick,
  label,
  color = COLORS.red,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        fontFamily: BUTTON_FONT,
        fontWeight: 700,
        fontSize: 13,
        minHeight: 44,
        padding: "0 12px",
        borderRadius: 999,
        border: active ? "none" : "1px solid rgba(245, 237, 226, 0.18)",
        background: active ? color : "rgba(245, 237, 226, 0.06)",
        color: active ? COLORS.trueWhite : COLORS.ink,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

export function PrimaryButton({
  onClick,
  disabled,
  color = COLORS.red,
  children,
  style,
  type = "button",
}: {
  onClick?: () => void;
  disabled?: boolean;
  color?: string;
  children: ReactNode;
  style?: CSSProperties;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        fontFamily: BUTTON_FONT,
        fontWeight: 700,
        fontSize: 16,
        minHeight: 52,
        padding: "0 20px",
        borderRadius: 999,
        border: "none",
        background: disabled ? COLORS.disabledBg : color,
        color: disabled ? COLORS.disabledText : COLORS.trueWhite,
        boxShadow: disabled ? "none" : "0 6px 24px -6px rgba(232, 86, 63, .5)",
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  onClick,
  disabled,
  children,
  style,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: BUTTON_FONT,
        fontWeight: 700,
        fontSize: 14,
        minHeight: 44,
        padding: "0 18px",
        borderRadius: 999,
        border: "1px solid rgba(245, 237, 226, 0.18)",
        background: disabled ? COLORS.disabledBg : "rgba(245, 237, 226, 0.06)",
        color: disabled ? COLORS.disabledText : COLORS.ink,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Badge({ children, color = COLORS.teal }: { children: ReactNode; color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: color,
        color: COLORS.trueWhite,
        fontFamily: BUTTON_FONT,
        fontWeight: 700,
        fontSize: 12,
        padding: "5px 12px",
        borderRadius: 999,
      }}
    >
      {children}
    </span>
  );
}
