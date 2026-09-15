import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Mic,
  MicOff,
  Grid3x3,
  RotateCcw,
  UserPlus,
  LogOut,
  ChevronUp,
  ChevronDown,
  Trophy,
} from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useVoice } from "@/lib/voiceContext";
import { useLanguage } from "@/lib/languageContext";
import { getGame } from "@/lib/brand";
import GamePicker from "./GamePicker";
import InviteSheet from "./InviteSheet";
import VoicePanel from "./VoicePanel";

/**
 * A persistent control strip for the party, mounted globally rather than per
 * page.
 *
 * Mounting it once in App.tsx (inside the providers, outside the routes) is
 * what makes "switch game without leaving" actually work: every game page
 * inherits invite / switch / rematch / mic without knowing this component
 * exists, so adding a game costs zero dock integration and no game page can
 * accidentally ship without a way back to the hub.
 *
 * It collapses to a single pill by default. Games here are played on phones in
 * portrait where every pixel of table is contested, so a permanently expanded
 * bar would be actively harmful — but the mic state stays visible even when
 * collapsed, because "am I transmitting?" is the one question a player needs
 * answered at a glance and getting it wrong is embarrassing in a way nothing
 * else in the UI is.
 */
export default function PartyDock() {
  const {
    partyState,
    myPlayerId,
    partyPickGame,
    partyRematch,
    partyReturnHub,
    partyLeave,
    addToast,
  } = useGame();
  const { isMuted, isConnecting, toggleMute, peerCount, speakingIds, audioBlocked } =
    useVoice();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [expanded, setExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  /**
   * Publish the dock's height as `--party-dock-h` on the root element.
   *
   * The dock is fixed to the bottom of every page, which means it sits on top
   * of anything else anchored there — and in a game that is always the action
   * bar. It covered Liar's Bar's "Make Claim" button completely: the player
   * could see their hand, select cards, and had no reachable way to play them.
   *
   * Reserving space rather than restacking is the fix that keeps working. Any
   * bottom-anchored element offsets itself by this variable and is correct
   * forever, including when the dock is expanded (which changes its height),
   * and including for pages written later by someone who has never read this
   * file. `.page` in index.css already accounts for it, so ordinary scrolling
   * pages need no change at all.
   */
  useLayoutEffect(() => {
    const el = shellRef.current;
    const root = document.documentElement;
    if (!el) {
      root.style.setProperty("--party-dock-h", "0px");
      return;
    }

    const publish = () => {
      // Includes the bottom padding that clears the iOS home indicator.
      const height = el.getBoundingClientRect().height;
      root.style.setProperty("--party-dock-h", `${Math.ceil(height)}px`);
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.setProperty("--party-dock-h", "0px");
    };
    // `partyState` is in the deps, not just `expanded`: the dock returns null
    // until a party exists, so on the render where one appears the ref goes
    // from null to attached. Without a dep that changes on that render, the
    // effect never re-runs and the variable stays at 0 — which is silently
    // exactly the bug this whole mechanism exists to prevent.
  }, [expanded, partyState?.roomId, partyState?.phase, partyState?.activeGameId]);

  // No party, nothing to dock. Standalone rooms and the landing page render
  // as they always did.
  if (!partyState) return null;

  const me = partyState.players.find((p) => p.id === myPlayerId);
  const isHost = Boolean(me?.isHost);
  const activeMeta = partyState.activeGameId ? getGame(partyState.activeGameId) : undefined;
  const connectedCount = partyState.players.filter((p) => p.isConnected).length;
  const leader = partyState.leaderboard[0];

  // Name whoever is speaking. With more than one, count them instead — a list
  // of three names doesn't fit and reads as noise anyway.
  const speakerNames = partyState.players
    .filter((p) => speakingIds.has(p.id === myPlayerId ? "me" : p.id))
    .map((p) => (p.id === myPlayerId ? t("party.you") : p.name));
  const speakerLabel =
    speakerNames.length === 0
      ? null
      : speakerNames.length === 1
        ? `🔊 ${speakerNames[0]}`
        : `🔊 ${speakerNames.length}`;

  const run = async (fn: () => Promise<void>, failMsg: string) => {
    try {
      await fn();
    } catch (err) {
      addToast(err instanceof Error ? err.message : failMsg, "error");
    }
  };

  return (
    <>
      <div
        ref={shellRef}
        className="fixed z-40 inset-x-0 bottom-0 pointer-events-none"
        style={{ paddingBottom: "var(--safe-b)" }}
      >
        <div className="mx-auto max-w-lg px-3 pb-3 pointer-events-auto">
          <div className="surface-lit rounded-xl overflow-hidden">
            {/* ---- Collapsed row: always visible ---- */}
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-2 min-w-0 flex-1 text-start btn-quiet rounded-md px-2 py-1.5"
                aria-expanded={expanded}
              >
                <span className="font-numeric text-sm text-gold shrink-0">
                  {partyState.roomId}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-sand shrink-0">
                  <Users size={13} />
                  {connectedCount}
                </span>
                {/* Who's talking, in the collapsed row. This is the one piece
                    of voice state worth permanent screen space: it answers
                    "who said that" without anyone having to say their name. */}
                {speakerLabel ? (
                  <span className="text-xs text-mint truncate">{speakerLabel}</span>
                ) : (
                  activeMeta && (
                    <span className="text-xs text-sand truncate hidden xs:inline">
                      · {activeMeta.emoji}
                    </span>
                  )
                )}
                {expanded ? (
                  <ChevronDown size={15} className="ms-auto text-sand shrink-0" />
                ) : (
                  <ChevronUp size={15} className="ms-auto text-sand shrink-0" />
                )}
              </button>

              {/* Mic stays in the collapsed row on purpose — see the comment
                  at the top of this file. */}
              <button
                onClick={toggleMute}
                disabled={isConnecting}
                className={[
                  "btn btn-sm shrink-0",
                  isMuted ? "btn-ghost" : "btn-live",
                  // Pulse only while actually transmitting, not merely unmuted.
                  // A permanently pulsing button is decoration; one that
                  // pulses when your voice is going out is feedback.
                  !isMuted && speakingIds.has("me") ? "pulse-live" : "",
                  audioBlocked ? "!border-gold !text-gold" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={isMuted ? t("voice.unmute") : t("voice.mute")}
                aria-pressed={!isMuted}
              >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                {!isMuted && peerCount > 0 && (
                  <span className="font-numeric text-xs">{peerCount}</span>
                )}
              </button>

              <button
                onClick={() => setInviteOpen(true)}
                className="btn btn-primary btn-sm shrink-0"
                aria-label={t("party.invite_title")}
              >
                <UserPlus size={16} />
                <span className="hidden sm:inline">{t("party.invite")}</span>
              </button>
            </div>

            {/* ---- Expanded panel ---- */}
            {expanded && (
              <div className="border-t border-border/60 px-3 py-3 space-y-2 animate-in">
                {leader && leader.played > 0 && (
                  <div className="flex items-center gap-2 text-xs text-sand px-1 pb-1">
                    <Trophy size={13} className="text-gold" />
                    <span className="truncate">
                      {t("party.leading")
                        .replace("{name}", leader.name)
                        .replace("{n}", String(leader.wins))}
                    </span>
                  </div>
                )}

                <VoicePanel players={partyState.players} />

                <div className="h-px bg-border/60" />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="btn btn-ghost btn-sm"
                  >
                    <Grid3x3 size={15} />
                    {t("party.switch_game")}
                  </button>

                  <button
                    onClick={() =>
                      run(partyRematch, t("party.rematch_failed"))
                    }
                    disabled={!isHost || !partyState.activeGameId}
                    className="btn btn-ghost btn-sm"
                  >
                    <RotateCcw size={15} />
                    {t("party.rematch")}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={async () => {
                      await run(partyReturnHub, t("party.hub_failed"));
                      navigate(`/r/${partyState.roomId}`);
                    }}
                    disabled={!isHost}
                    className="btn btn-quiet btn-sm"
                  >
                    {t("party.back_to_hub")}
                  </button>

                  <button
                    onClick={async () => {
                      await partyLeave();
                      navigate("/");
                    }}
                    className="btn btn-quiet btn-sm text-ruby"
                  >
                    <LogOut size={15} />
                    {t("party.leave")}
                  </button>
                </div>

                {!isHost && (
                  <p className="text-center text-[11px] text-sand pt-1">
                    {t("party.host_only")}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <GamePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentGameId={partyState.activeGameId}
        canPick={isHost}
        onPick={(gameId) => partyPickGame(gameId)}
      />

      <InviteSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        roomCode={partyState.roomId}
        gameName={activeMeta?.name.en}
      />
    </>
  );
}
