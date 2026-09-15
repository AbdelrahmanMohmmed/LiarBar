import { useState } from "react";
import { MapPin, Search } from "lucide-react";
import { useLanguage } from "@/lib/languageContext";
import GameSetupPage, { OptionRow } from "@/components/game/GameSetupPage";

/**
 * Spyfall setup.
 *
 * Two settings only. The game has no board, no variants and no house rules
 * worth surfacing, so a longer options list would be inventing decisions for a
 * host to make while five people wait.
 *
 * The one thing this page must do beyond starting a room is say clearly that a
 * microphone is required. Spyfall without voice isn't a reduced version of
 * Spyfall, it's nothing — and a group that starts it muted will conclude the
 * game is broken rather than that they are.
 */
export default function SpyfallHome() {
  const { t } = useLanguage();
  const [minutes, setMinutes] = useState(8);
  const [targetScore, setTargetScore] = useState(6);

  return (
    <GameSetupPage
      gameId="spyfall"
      seoTitle={t("spyfall.seo_title")}
      genres={["Party", "Social deduction", "Bluffing"]}
      voiceNote={t("spyfall.voice_required")}
      hero={
        <div className="flex gap-3">
          <span className="grid place-items-center w-12 h-12 rounded-lg bg-mint/15 text-live">
            <MapPin size={22} />
          </span>
          <span className="grid place-items-center w-12 h-12 rounded-lg bg-ruby/15 text-ruby">
            <Search size={22} />
          </span>
        </div>
      }
      options={
        <>
          <OptionRow
            legend={t("spyfall.round_length")}
            value={minutes}
            onChange={setMinutes}
            choices={[5, 8, 12].map((m) => ({
              value: m,
              label: `${m} ${t("spyfall.min")}`,
            }))}
          />
          <OptionRow
            legend={t("spyfall.play_to")}
            value={targetScore}
            onChange={setTargetScore}
            choices={[4, 6, 10].map((n) => ({ value: n, label: String(n) }))}
          />
        </>
      }
      buildInput={() => ({
        maxPlayers: 8,
        roundSeconds: minutes * 60,
        targetScore,
      })}
      rulesTitle={t("spyfall.how_title")}
      rules={[
        t("spyfall.how_1"),
        t("spyfall.how_2"),
        t("spyfall.how_3"),
        t("spyfall.how_4"),
      ]}
    />
  );
}
