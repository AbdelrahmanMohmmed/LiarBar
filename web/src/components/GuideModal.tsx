import { memo } from "react";
import { useLanguage } from "@/lib/languageContext";
import { X, BookOpen, Target, Settings, Gamepad2, Swords, SkipForward, Trophy, Grid3X3 } from "lucide-react";

interface GuideModalProps {
  open: boolean;
  onClose: () => void;
}

const sections = [
  { key: "objective", icon: Target },
  { key: "setup", icon: Settings },
  { key: "gameplay", icon: Gamepad2 },
  { key: "challenge", icon: Swords },
  { key: "pass", icon: SkipForward },
  { key: "winning", icon: Trophy },
  { key: "domino", icon: Grid3X3 },
] as const;

export const GuideModal = memo(function GuideModal({ open, onClose }: GuideModalProps) {
  const { t, lang } = useLanguage();
  const isRtl = lang === "ar";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-[#1c0d0d]/95 backdrop-blur-xl border border-amber-900/40 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-amber-900/20 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h3 className="text-white font-bold text-lg">{t("guide.title")}</h3>
          </div>
          <button onClick={onClose} className="text-amber-200/40 hover:text-white p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          {sections.map(({ key, icon: Icon }) => (
            <div key={key} className="bg-[#2a1515] rounded-xl p-4 border border-amber-900/20">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-amber-400 shrink-0" />
                <h4 className="text-amber-300 font-bold text-sm">{t(`guide.${key}_title`)}</h4>
              </div>
              <p className="text-amber-100/80 text-sm leading-relaxed">{t(`guide.${key}`)}</p>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-amber-900/20 shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-amber-900/30 transition-all active:scale-95"
          >
            {t("guide.close")}
          </button>
        </div>
      </div>
    </div>
  );
});
