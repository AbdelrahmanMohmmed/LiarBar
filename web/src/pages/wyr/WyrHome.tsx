import { useState } from "react";
import { useLanguage } from "@/lib/languageContext";
import GameSetupPage, { OptionRow } from "@/components/game/GameSetupPage";

/**
 * Would You Rather setup. One option: how long the match runs.
 *
 * The hero is two stacked cards — the game's entire interface in miniature. It
 * explains the game faster than the blurb does, and costs nothing to render.
 */
export default function WyrHome() {
  const { t } = useLanguage();
  const [targetScore, setTargetScore] = useState(10);

  return (
    <GameSetupPage
      gameId="wyr"
      seoTitle={t("wyr.seo_title")}
      genres={["Party", "Social", "Trivia"]}
      voiceNote={t("wyr.voice_note")}
      hero={
        <div className="w-44 space-y-2" aria-hidden>
          <div className="h-10 rounded-lg border-2 border-coral/60 bg-coral/10" />
          <div className="h-10 rounded-lg border-2 border-border bg-surface-raised" />
        </div>
      }
      options={
        <OptionRow
          legend={t("chameleon.play_to")}
          value={targetScore}
          onChange={setTargetScore}
          choices={[
            { value: 7, label: "7" },
            { value: 10, label: "10" },
            { value: 15, label: "15" },
          ]}
          hint={t("wyr.length_hint")}
        />
      }
      buildInput={() => ({ maxPlayers: 8, targetScore })}
      rulesTitle={t("wyr.how_title")}
      rules={[t("wyr.how_1"), t("wyr.how_2"), t("wyr.how_3"), t("wyr.how_4")]}
    />
  );
}
