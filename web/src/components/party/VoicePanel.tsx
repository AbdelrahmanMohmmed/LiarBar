import { useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, AlertTriangle, Radio, Loader2 } from "lucide-react";
import { useVoice, hasTurnRelay, type PeerHealth } from "@/lib/voiceContext";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import type { PlayerData } from "@/lib/types";

/**
 * Voice status for the whole room: who's talking, who can't connect, and the
 * one tap that fixes blocked audio.
 *
 * ## The three things this makes visible
 *
 * 1. **Your own mic level.** Previously the only feedback that your mic worked
 *    was somebody else telling you. Watching your own bar move answers it in a
 *    second, silently, without interrupting the game.
 * 2. **Who is speaking.** Six compressed voices through a phone speaker are
 *    genuinely hard to tell apart. Without this, players say each other's names
 *    constantly just to address someone.
 * 3. **Who can't hear you, and why.** A peer that exhausted its ICE restarts
 *    is almost always a missing TURN relay, and that used to present as
 *    "voice is broken" with no way to tell it apart from a muted mic.
 */

function LevelBar({ id }: { id: string }) {
  const { getLevel } = useVoice();
  const ref = useRef<HTMLSpanElement>(null);

  // Animated from a frame loop writing a transform directly, NOT from React
  // state. A level meter updates sixty times a second; routing that through
  // state would re-render the player list sixty times a second and visibly
  // stall the game's own animations on a phone.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const level = getLevel(id);
        el.style.transform = `scaleX(${Math.max(0.04, level)})`;
        el.style.opacity = level > 0.05 ? "1" : "0.25";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [id, getLevel]);

  return (
    <span className="block w-full h-1 rounded-pill bg-surface-sunken overflow-hidden">
      <span
        ref={ref}
        className="block h-full w-full bg-mint origin-left"
        style={{ transform: "scaleX(0.04)" }}
      />
    </span>
  );
}

function HealthDot({ health }: { health: PeerHealth | undefined }) {
  const { t } = useLanguage();
  const map: Record<PeerHealth, { color: string; label: string }> = {
    connecting: { color: "bg-gold", label: t("voice.h_connecting") },
    connected: { color: "bg-mint", label: t("voice.h_connected") },
    recovering: { color: "bg-gold animate-pulse", label: t("voice.h_recovering") },
    failed: { color: "bg-ruby", label: t("voice.h_failed") },
  };
  const entry = health ? map[health] : null;
  if (!entry) return null;
  return (
    <span
      className={`w-1.5 h-1.5 rounded-pill shrink-0 ${entry.color}`}
      title={entry.label}
      aria-label={entry.label}
    />
  );
}

export default function VoicePanel({ players }: { players: PlayerData[] }) {
  const { myPlayerId } = useGame();
  const {
    isMuted,
    isConnecting,
    toggleMute,
    speakingIds,
    peerHealth,
    anyoneFailed,
    audioBlocked,
    enableAudio,
    micError,
    usingRelay,
  } = useVoice();
  const { t } = useLanguage();

  const humans = players.filter((p) => !p.isBot);

  return (
    <div className="space-y-2">
      {/* Blocked audio is silent and invisible: the call is up, everyone else
          hears you, and you hear nothing with no error anywhere. It's the
          single most common "voice doesn't work" report, and it's one tap. */}
      {audioBlocked && (
        <button onClick={enableAudio} className="btn btn-live btn-sm w-full">
          <Volume2 size={15} />
          {t("voice.tap_to_hear")}
        </button>
      )}

      {micError && (
        <p className="text-xs text-ruby flex items-start gap-1.5 px-1">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {micError}
        </p>
      )}

      {/* "Someone can't connect to you" is true but unactionable. When this
          build shipped without a TURN relay it is also almost certainly the
          cause — STUN alone cannot cross the symmetric NAT most mobile
          carriers use — and that is a deployment fix, not something the
          player can do anything about. Say which one it is. */}
      {anyoneFailed && (
        <p className="text-xs text-gold flex items-start gap-1.5 px-1">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {hasTurnRelay() ? t("voice.some_failed") : t("voice.no_relay")}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={toggleMute}
          disabled={isConnecting}
          className={`btn btn-sm flex-1 ${isMuted ? "btn-ghost" : "btn-live"}`}
          aria-pressed={!isMuted}
        >
          {isConnecting ? (
            <Loader2 size={15} className="animate-spin" />
          ) : isMuted ? (
            <MicOff size={15} />
          ) : (
            <Mic size={15} />
          )}
          {isMuted ? t("voice.unmute") : t("voice.mute")}
        </button>

        {usingRelay && (
          <span className="chip" title={t("voice.relay_hint")}>
            <Radio size={11} />
            {t("voice.relay")}
          </span>
        )}
      </div>

      <ul className="space-y-1.5">
        {humans.map((player) => {
          const isMe = player.id === myPlayerId;
          const meterId = isMe ? "me" : player.id;
          const speaking = speakingIds.has(meterId);

          return (
            <li key={player.id} className="flex items-center gap-2">
              <HealthDot
                health={isMe ? (isMuted ? undefined : "connected") : peerHealth[player.id]}
              />
              <span
                className={`text-xs truncate w-20 shrink-0 transition-colors ${
                  speaking ? "text-live font-bold" : "text-sand"
                }`}
              >
                {isMe ? t("party.you") : player.name}
              </span>
              <span className="flex-1 min-w-0">
                <LevelBar id={meterId} />
              </span>
            </li>
          );
        })}
      </ul>

      {isMuted && (
        <p className="text-[11px] text-sand text-center pt-1">
          {t("voice.listening_only")}
        </p>
      )}
    </div>
  );
}
