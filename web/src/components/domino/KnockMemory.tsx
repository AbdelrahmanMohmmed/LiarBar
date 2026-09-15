import { useLanguage } from "@/lib/languageContext";
import type { DominoSeatState } from "@/lib/dominoTypes";

/**
 * Who is dead on what.
 *
 * ## Why this exists
 *
 * A knock in domino is a proof: you cannot knock while holding a playable
 * tile, so every number that was open when someone knocked is a number they
 * demonstrably do not have. Strong players hold that in their heads and play
 * around it — deliberately leaving an opponent stuck is the single best move
 * in the game.
 *
 * Casual players don't remember, so they never get to make that move, never
 * see why anyone else's move was clever, and conclude that domino is luck.
 * That was the honest core of "the game isn't fun": the interesting layer was
 * present but invisible.
 *
 * This panel surfaces information that was already fully public and derivable.
 * It gives nobody an advantage they weren't entitled to — it removes a memory
 * test that was standing between players and the actual game.
 *
 * ## Why it's rendered as a grid rather than prose
 *
 * "Omar knocked on 3 and 5" is a sentence you have to parse. A 7-wide grid of
 * pip values per player is a shape you read. Mid-conversation, on a phone,
 * only the second one works.
 */

interface Props {
  seats: DominoSeatState[];
  mySeat: number | null;
  /** How many of each pip value are already face-up on the table. */
  playedPipCount: number[];
  compact?: boolean;
}

/** Seven tiles show each value; a double shows it twice, so eight faces exist. */
const FACES_PER_VALUE = 8;

export default function KnockMemory({
  seats,
  mySeat,
  playedPipCount,
  compact = false,
}: Props) {
  const { t } = useLanguage();

  const anyKnocks = seats.some((s) => s.knockedOn.length > 0);

  return (
    <div className="surface rounded-lg p-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-sand mb-2">
        {t("domino.reading_the_table")}
      </h3>

      {/* How many of each number are still out there. This is the other half
          of the read: a number with seven faces already played is nearly dead
          for everyone, and leading it is a wasted move. */}
      <div className="flex items-center gap-1 mb-3">
        <span className="text-[10px] text-sand w-10 shrink-0">
          {t("domino.left_out")}
        </span>
        {playedPipCount.map((played, value) => {
          const remaining = Math.max(0, FACES_PER_VALUE - played);
          return (
            <div
              key={value}
              className="flex-1 flex flex-col items-center gap-0.5"
              title={t("domino.n_left")
                .replace("{n}", String(remaining))
                .replace("{v}", String(value))}
            >
              <span className="font-numeric text-[11px] text-cream">{value}</span>
              <div className="w-full h-1 rounded-pill bg-surface-sunken overflow-hidden">
                <div
                  className="h-full bg-mint transition-all duration-300"
                  style={{ width: `${(remaining / FACES_PER_VALUE) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {anyKnocks ? (
        <ul className="space-y-1.5">
          {seats
            .filter((s) => s.knockedOn.length > 0)
            .map((seat) => (
              <li key={seat.seat} className="flex items-center gap-2">
                <span
                  className={`text-xs truncate ${
                    seat.seat === mySeat ? "text-sand" : "text-cream"
                  } ${compact ? "w-16" : "w-20"} shrink-0`}
                >
                  {seat.seat === mySeat ? t("domino.you") : seat.name}
                </span>
                <span className="text-[10px] text-sand shrink-0">
                  {t("domino.no")}
                </span>
                <span className="flex gap-1 flex-wrap">
                  {[...seat.knockedOn]
                    .sort((a, b) => a - b)
                    .map((value) => (
                      <span
                        key={value}
                        className="grid place-items-center w-5 h-5 rounded-sm bg-ruby/20 text-ruby font-numeric text-[11px] border border-ruby/30"
                      >
                        {value}
                      </span>
                    ))}
                </span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-[11px] text-sand">{t("domino.no_knocks_yet")}</p>
      )}
    </div>
  );
}
