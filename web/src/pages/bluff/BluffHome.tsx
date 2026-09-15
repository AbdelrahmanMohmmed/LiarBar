import { useState } from "react";
import { useLanguage } from "@/lib/languageContext";
import GameSetupPage, { OptionRow } from "@/components/game/GameSetupPage";

/**
 * Bluff setup. Two options: how many rounds, and which language the room
 * plays in.
 *
 * The language belongs to the *room*, not to each viewer, and that is worth
 * being explicit about here rather than inheriting it silently from the UI
 * toggle: the true answer sits on the board next to answers players typed
 * themselves, so a room where half the answers arrive in Arabic and the true
 * one renders in English has given the game away. Choosing it once, at the
 * start, is the only version of this that works.
 *
 * The hero is three stacked bars with one lit — the choosing screen in
 * miniature, which explains the game faster than the blurb does.
 */
export default function BluffHome() {
  const { t, lang } = useLanguage();
  const [rounds, setRounds] = useState(5);
  const [language, setLanguage] = useState<"ar" | "en">(lang);

  return (
    <GameSetupPage
      gameId="bluff"
      seoTitle={t("bluff.seo_title")}
      genres={["Party", "Social", "Word"]}
      voiceNote={t("bluff.voice_note")}
      hero={
        <div className="w-44 space-y-2" aria-hidden>
          <div className="h-8 rounded-lg border-2 border-border bg-surface-raised" />
          <div className="h-8 rounded-lg border-2 border-mint/70 bg-mint/12" />
          <div className="h-8 rounded-lg border-2 border-border bg-surface-raised" />
        </div>
      }
      options={
        <>
          <OptionRow
            legend={t("bluff.rounds")}
            value={rounds}
            onChange={setRounds}
            choices={[
              { value: 3, label: "3" },
              { value: 5, label: "5" },
              { value: 8, label: "8" },
            ]}
            hint={t("bluff.length_hint")}
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
      buildInput={() => ({ maxPlayers: 8, rounds, language })}
      rulesTitle={t("bluff.how_title")}
      rules={[t("bluff.how_1"), t("bluff.how_2"), t("bluff.how_3"), t("bluff.how_4")]}
    />
  );
}
