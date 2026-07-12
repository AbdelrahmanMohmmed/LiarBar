import type { CSSProperties, ReactNode } from "react";
import { COLORS, BUTTON_FONT } from "./theme";

export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: COLORS.white,
        borderRadius: 24,
        border: `3px solid ${COLORS.ink}`,
        boxShadow: `6px 6px 0 ${COLORS.ink}`,
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
      <label style={{ display: "block", fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, textAlign: align }}>
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
    padding: "10px 14px",
    borderRadius: 12,
    border: `2px solid ${COLORS.ink}`,
    background: COLORS.white,
    color: COLORS.ink,
    fontSize: 15,
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
        padding: "10px 12px",
        borderRadius: 999,
        border: active ? "none" : `2px solid ${COLORS.ink}`,
        background: active ? COLORS.ink : COLORS.white,
        color: active ? COLORS.cream : COLORS.ink,
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
  color = COLORS.ink,
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
        padding: "10px 12px",
        borderRadius: 999,
        border: active ? "none" : `2px solid ${COLORS.ink}`,
        background: active ? color : COLORS.white,
        color: active ? COLORS.cream : COLORS.ink,
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
        padding: "12px 20px",
        borderRadius: 999,
        border: "none",
        background: disabled ? COLORS.disabledBg : color,
        color: disabled ? COLORS.disabledText : COLORS.cream,
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
        padding: "10px 18px",
        borderRadius: 999,
        border: `2px solid ${COLORS.ink}`,
        background: disabled ? COLORS.disabledBg : COLORS.white,
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
        color: COLORS.cream,
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
