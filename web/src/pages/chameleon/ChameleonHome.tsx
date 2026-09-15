import { useState } from "react";
import { useLanguage } from "@/lib/languageContext";
import GameSetupPage, { OptionRow } from "@/components/game/GameSetupPage";

/**
 * Chameleon setup. One option — how long a match runs.
 *
 * The hero is a miniature of the actual grid rather than an illustration: it
 * shows the game's one screen, which explains the game faster than any
 * sentence and costs nothing to render.
 */
export default function ChameleonHome() {
  const { t } = useLanguage();
  const [targetScore, setTargetScore] = useState(8);

  return (
    <GameSetupPage
      gameId="chameleon"
      seoTitle={t("chameleon.seo_title")}
      genres={["Party", "Social deduction", "Word game"]}
      voiceNote={t("chameleon.voice_note")}
      hero={
        <div className="grid grid-cols-4 gap-1 w-40" aria-hidden>
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className={`aspect-square rounded-sm ${
                i === 6
                  ? "bg-violet/60 border border-violet"
                  : "bg-surface-raised border border-border"
              }`}
            />
          ))}
        </div>
      }
      options={
        <OptionRow
          legend={t("chameleon.play_to")}
          value={targetScore}
          onChange={setTargetScore}
          choices={[
            { value: 6, label: "6" },
            { value: 8, label: "8" },
            { value: 12, label: "12" },
          ]}
          hint={t("chameleon.length_hint")}
        />
      }
      buildInput={() => ({ maxPlayers: 8, targetScore })}
      rulesTitle={t("chameleon.how_title")}
      rules={[
        t("chameleon.how_1"),
        t("chameleon.how_2"),
        t("chameleon.how_3"),
        t("chameleon.how_4"),
      ]}
    />
  );
}
