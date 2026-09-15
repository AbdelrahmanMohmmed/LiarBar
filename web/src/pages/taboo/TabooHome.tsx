import { useState } from "react";
import { useLanguage } from "@/lib/languageContext";
import GameSetupPage, { OptionRow } from "@/components/game/GameSetupPage";

/**
 * Taboo setup. Two options, and neither of them is teams.
 *
 * Teams are drawn by the server, alternating around the seat order, because
 * the team-picking screen is the single biggest drop-off in the catalogue —
 * five people tapping through a lobby while one explains the roles. A party
 * that draws badly can shuffle from inside the game between turns, which is
 * cheaper than a screen everybody passes through every time.
 *
 * The hero is a card with its forbidden words struck through: it explains the
 * entire game in one glance and costs nothing to render.
 */
export default function TabooHome() {
  const { t, lang } = useLanguage();
  const [targetScore, setTargetScore] = useState(15);
  const [language, setLanguage] = useState<"ar" | "en">(lang);

  return (
    <GameSetupPage
      gameId="taboo"
      seoTitle={t("taboo.seo_title")}
      genres={["Party", "Word", "Team"]}
      voiceNote={t("taboo.voice_note")}
      hero={
        <div className="w-44 rounded-lg border-2 border-border bg-surface-raised p-3" aria-hidden>
          <div className="h-4 w-20 rounded bg-cream/80 mx-auto mb-2.5" />
          <div className="space-y-1.5">
            {[14, 11, 16, 9].map((w, i) => (
              <div key={i} className="mx-auto h-2 rounded bg-ruby/40" style={{ width: w * 4 }} />
            ))}
          </div>
        </div>
      }
      options={
        <>
          <OptionRow
            legend={t("taboo.play_to")}
            value={targetScore}
            onChange={setTargetScore}
            choices={[
              { value: 10, label: "10" },
              { value: 15, label: "15" },
              { value: 25, label: "25" },
            ]}
            hint={t("taboo.length_hint")}
          />
          <OptionRow
            legend={t("bluff.language")}
            value={language}
            onChange={setLanguage}
            choices={[
              { value: "ar", label: "العربية" },
              { value: "en", label: "English" },
            ]}
          />
        </>
      }
      buildInput={() => ({ maxPlayers: 8, targetScore, language })}
      rulesTitle={t("taboo.how_title")}
      rules={[t("taboo.how_1"), t("taboo.how_2"), t("taboo.how_3"), t("taboo.how_4")]}
    />
  );
}
