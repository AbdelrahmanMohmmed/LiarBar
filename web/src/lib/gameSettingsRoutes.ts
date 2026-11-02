/**
 * Where each game's settings page lives.
 *
 * The hub's "Game Settings" button is a settings *page*, not a sheet: the host
 * gets a full screen with room around each option, and a URL they can reload.
 *
 * Every game has one. Rento keeps a hand-built page because its rules and the
 * per-device appearance choices do not belong in the same layout as the rest;
 * everything else shares the generic page at /r/:roomId/settings/:gameId, whose
 * controls mirror each game's setup route.
 */
const DEDICATED_SETTINGS: Record<string, (roomId: string) => string> = {
  rento: () => "/rento/settings",
};

/** The page a host lands on to configure `gameId` inside `roomId`. */
export function gameSettingsPath(gameId: string, roomId: string): string {
  const dedicated = DEDICATED_SETTINGS[gameId];
  return dedicated ? dedicated(roomId) : `/r/${roomId}/settings/${gameId}`;
}
