import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
 *
 * ## …except on the first sighting, if the page contradicts the party
 *
 * Adopting the first state unconditionally had a cost that only shows up on a
 * reload: refresh mid-game and you re-enter at `/r/:roomId`, the party says
 * `playing`, the router adopts that and stays put — so you sit on the hub
 * watching a "Start" button while your friends play without you. Pressing it
 * changes nothing (the server is already playing, so the state never changes
 * and the router never fires), which reads as a dead button.
 *
 * So the first sighting *does* correct the page, but only when the page is
 * itself a party surface for this room — the hub, the join page, or a game
 * board. Anywhere else (the landing page, another room, a game's home page) is
 * a deliberate choice by the player and is left alone, which is what the rule
 * was protecting in the first place.
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
    case "bluff":
      return `/bluff/game/${roomId}`;
    case "taboo":
      return `/taboo/game/${roomId}`;
    case "rento":
      return `/rento/game/${roomId}`;
    default:
      return `/lobby/${roomId}`;
  }
}

/**
 * Is this path one of the pages that belong to `roomId`?
 *
 * Every party surface ends in the room code — `/r/364900`, `/j/364900`,
 * `/game/364900`, `/codenames/game/364900`, `/lobby/364900` — and nothing else
 * does, so the last segment is the whole test.
 */
function isPartySurface(pathname: string, roomId: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] === roomId;
}

export default function PartyRouter() {
  const { partyState } = useGame();
  const navigate = useNavigate();
  const location = useLocation();

  // What we last acted on: `${phase}:${activeGameId}`. Null until we've seen
  // the party once, so mounting into an existing game doesn't navigate.
  const lastRef = useRef<string | null>(null);

  // Read inside the effect without making the effect depend on it: we only
  // ever consult the path at the moment the party state moves.
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    if (!partyState) {
      lastRef.current = null;
      return;
    }

    const key = `${partyState.phase}:${partyState.activeGameId ?? ""}`;
    const where =
      partyState.phase === "playing" && partyState.activeGameId
        ? gameRoute(partyState.activeGameId, partyState.roomId)
        : partyState.phase === "hub"
          ? `/r/${partyState.roomId}`
          : null;

    if (lastRef.current === null) {
      lastRef.current = key;
      // Adopt the state, and correct the page only if it is one of this
      // room's own pages showing the wrong thing — see the note above.
      if (where && isPartySurface(pathRef.current, partyState.roomId) && pathRef.current !== where) {
        navigate(where, { replace: true });
      }
      return;
    }
    if (lastRef.current === key) return;
    lastRef.current = key;

    if (where) navigate(where);
  }, [partyState?.phase, partyState?.activeGameId, partyState?.roomId, partyState, navigate]);

  return null;
}
