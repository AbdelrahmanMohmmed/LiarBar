import { memo } from "react";
import { useTheme } from "@/lib/themeContext";
import type { GameTheme } from "@/lib/theme";
import { THEMES } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Palette } from "lucide-react";

const themeOptions: { key: GameTheme; label: string; desc: string; previewBg: string; previewAccent: string }[] = [
  {
    key: "standard",
    label: "Standard",
    desc: "Red-backed cards, green felt table",
    previewBg: "#0d1a0d",
    previewAccent: "#F59E0B",
  },
  {
    key: "classic",
    label: "Classic",
    desc: "Blue-backed cards, dark navy table",
    previewBg: "#0F172A",
    previewAccent: "#FBBF24",
  },
  {
    key: "vip",
    label: "VIP",
    desc: "Gold-backed cards, premium dark table",
    previewBg: "#111827",
    previewAccent: "#FBBF24",
  },
];

interface ThemeSelectorProps {
  className?: string;
}

export const ThemeSelector = memo(function ThemeSelector({ className }: ThemeSelectorProps) {
  const { theme, setTheme, assets } = useTheme();

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-amber-200/80 text-xs block flex items-center gap-1.5">
        <Palette className="w-3.5 h-3.5" />
        Table Theme
      </label>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {themeOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setTheme(opt.key)}
            className={cn(
              "rounded-lg p-1.5 sm:p-2.5 border-2 transition-all text-left flex flex-col items-center sm:items-start",
              theme === opt.key
                ? "border-amber-500 bg-amber-900/20 shadow-md"
                : "border-transparent bg-[#2a1515] hover:bg-[#3a1f1f]",
            )}
          >
            {/* Mini preview */}
            <div
              className="w-full h-6 sm:h-8 rounded-md mb-1 sm:mb-1.5 flex items-center justify-center"
              style={{ backgroundColor: opt.previewBg }}
            >
              <div
                className="w-4 h-2.5 sm:w-5 sm:h-3 rounded-sm flex items-center justify-center"
                style={{
                  background: `linear-gradient(to bottom right, ${opt.previewAccent}88, ${opt.previewAccent}44)`,
                  borderColor: opt.previewAccent,
                  borderWidth: 1,
                }}
              >
                <span className="text-white text-[5px] sm:text-[6px] font-bold">?</span>
              </div>
            </div>
            <p className="text-white text-[10px] sm:text-xs font-semibold text-center sm:text-left w-full">{opt.label}</p>
            <p className="hidden sm:block text-amber-200/40 text-[9px] leading-tight mt-0.5">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
});
