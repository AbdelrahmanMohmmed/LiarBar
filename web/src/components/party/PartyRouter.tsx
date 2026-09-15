import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/lib/gameContext";

/**
 * Follows the party into whatever game it just switched into.
 *
 * ## The bug this fixes
 *
 * "Switch game" lives in the PartyDock, which is mounted on every page. But
 * the code that *navigated* to the new game lived only in PartyHub. So
 * switching from the hub worked, and switching from inside a running game —
 * which is the far more common case, and the entire point of the feature — left
 * everyone staring at the old game's board while the server had already moved
 * on. No error, no clue, just a screen that had quietly stopped meaning
 * anything.
 *
 * Mounting the follower globally, next to the dock, is the fix: any page the
 * dock can act from is a page this can navigate away from.
 *
 * ## Why it only reacts to *changes*
 *
 * It records the party's game the first time it sees it and navigates only
 * when that changes afterwards. Without that, it would re-navigate on every
 * render — so a player who deliberately opened the landing page mid-session
 * would be yanked back into the game, repeatedly, with no way out.
 *
 * The host's action is what moves everyone; a player's own navigation is left
 * alone.
 */

/**
 * Where each game renders.
 *
 * Kept here rather than in any one page so "which URL does this game live at"
 * is answered in exactly one place. Games without a bespoke page share the
 * generic lobby shell.
 */
export function gameRoute(gameId: string, roomId: string): string {
  switch (gameId) {
    case "liars-bar":
      return `/game/${roomId}`;
    case "codenames":
      return `/codenames/game/${roomId}`;
    case "higher-lower":
      return `/higher-lower/game/${roomId}`;
    case "domino":
      return `/domino/game/${roomId}`;
    case "spyfall":
      return `/spyfall/game/${roomId}`;
    case "chameleon":
      return `/chameleon/game/${roomId}`;
    case "wyr":
      return `/wyr/game/${roomId}`;
    case "rento":
      return `/rento/game/${roomId}`;
    default:
      return `/lobby/${roomId}`;
  }
}

export default function PartyRouter() {
  const { partyState } = useGame();
  const navigate = useNavigate();

  // What we last acted on: `${phase}:${activeGameId}`. Null until we've seen
  // the party once, so mounting into an existing game doesn't navigate.
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    if (!partyState) {
      lastRef.current = null;
      return;
    }

    const key = `${partyState.phase}:${partyState.activeGameId ?? ""}`;
    if (lastRef.current === null) {
      // First sighting — adopt it without moving anyone.
      lastRef.current = key;
      return;
    }
    if (lastRef.current === key) return;
    lastRef.current = key;

    if (partyState.phase === "playing" && partyState.activeGameId) {
      navigate(gameRoute(partyState.activeGameId, partyState.roomId));
    } else if (partyState.phase === "hub") {
      navigate(`/r/${partyState.roomId}`);
    }
  }, [partyState?.phase, partyState?.activeGameId, partyState?.roomId, partyState, navigate]);

  return null;
}
