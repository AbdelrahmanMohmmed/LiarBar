import { memo } from "react";
import { useLanguage } from "@/lib/languageContext";

export const LangToggle = memo(function LangToggle() {
  const { lang, isSwitching, toggleLang, t } = useLanguage();

  const label = lang === "en" ? "العربية" : "English";

  return (
    <button
      onClick={toggleLang}
      disabled={isSwitching}
      className="dc-lang-btn"
      style={{
        border: "2px solid #2B2420",
        background: "#FFFFFF",
        color: "#2B2420",
        fontFamily: lang === "en" ? "'Tajawal', sans-serif" : "'Baloo 2', sans-serif",
        fontWeight: 700,
        fontSize: 14,
        padding: "7px 16px",
        borderRadius: 999,
        cursor: isSwitching ? "wait" : "pointer",
        opacity: isSwitching ? 0.7 : 1,
        boxShadow: "2px 2px 0 rgba(43,36,32,0.15)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1.2,
      }}
      title={t("lang.switch_to")}
    >
      {label}
    </button>
  );
});

