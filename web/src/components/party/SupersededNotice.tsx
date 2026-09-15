import { useNavigate } from "react-router-dom";
import { MonitorSmartphone } from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";

/**
 * "You opened this room somewhere else."
 *
 * A reconnect takes over the seat, which is correct — the newest window is the
 * one the player is actually looking at. But the *old* window used to be
 * silently orphaned: still subscribed to the room, still receiving broadcasts,
 * and rendering its own player as offline while everything around it kept
 * updating. That looks like a bug in the game, and there is no way for a player
 * to work out what happened.
 *
 * This is a full-screen takeover rather than a toast on purpose. Everything
 * behind it is stale and every control on it is now a lie; letting someone keep
 * tapping a dead board is worse than stopping them.
 *
 * The way out is a reload, which reclaims the seat from the other window — the
 * same takeover, in the other direction. Whichever window the player is looking
 * at is the one that wins, which is the behaviour they'd expect without ever
 * thinking about it.
 */
export default function SupersededNotice() {
  const { supersededRoomId } = useGame();
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (!supersededRoomId) return null;

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-[hsl(var(--ink-900))]/95 backdrop-blur-sm px-6"
      role="alertdialog"
      aria-modal="true"
    >
      <div className="surface-lit rounded-xl p-6 max-w-sm w-full text-center">
        <MonitorSmartphone size={30} className="mx-auto text-gold mb-3" />
        <h2 className="font-display text-xl text-cream mb-2">
          {t("superseded.title")}
        </h2>
        <p className="text-sm text-sand mb-5">{t("superseded.body")}</p>

        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary w-full mb-2"
        >
          {t("superseded.resume")}
        </button>
        <button
          onClick={() => {
            navigate("/");
            window.location.reload();
          }}
          className="btn btn-quiet w-full"
        >
          {t("superseded.leave")}
        </button>
      </div>
    </div>
  );
}
