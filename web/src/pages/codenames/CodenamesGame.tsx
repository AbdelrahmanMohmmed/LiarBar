import { COLORS, uiFont } from "./theme";
import { useLanguage } from "@/lib/languageContext";

export default function CodenamesGame() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: COLORS.cream,
        color: COLORS.ink,
        fontFamily: uiFont(isAr),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      …
    </div>
  );
}
