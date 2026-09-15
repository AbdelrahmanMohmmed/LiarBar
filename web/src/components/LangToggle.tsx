import { memo } from "react";
import { useLanguage } from "@/lib/languageContext";
import { Globe } from "lucide-react";

export const LangToggle = memo(function LangToggle() {
  const { lang, toggleLang, t } = useLanguage();

  return (
    <button
      onClick={toggleLang}
      className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sand hover:text-cream hover:bg-surface-raised transition-all text-xs font-mono"
      title={t("lang.switch_to")}
    >
      <Globe className="w-3.5 h-3.5" />
      <span className="font-bold">{lang === "en" ? "EN" : "AR"}</span>
    </button>
  );
});
