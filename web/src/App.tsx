import { Suspense, lazy, useEffect, useRef, type ComponentType } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GameProvider, useGame } from "@/lib/gameContext";
import { VoiceProvider } from "@/lib/voiceContext";
import { LanguageProvider } from "@/lib/languageContext";
import { ThemeProvider } from "@/lib/themeContext";
import { toast, Toaster } from "sonner";

// Eager: the three routes a cold visitor can actually land on. Everything else
// is behind a socket connection they don't have yet.
import Landing from "./pages/Landing";
import JoinParty from "./pages/party/JoinParty";
import NotFound from "./pages/NotFound";
import PartyDock from "./components/party/PartyDock";
import PartyRouter from "./components/party/PartyRouter";
import SupersededNotice from "./components/party/SupersededNotice";

/**
 * Routes are code-split, and the split is the point.
 *
 * Everything used to ship in one chunk: ~940KB raw, ~250KB gzipped, including
 * every game's client — Rento's 1,600-line board, the Fighter sprite loop,
 * three separate card renderers — downloaded in full before the landing page
 * could paint.
 *
 * The target device is a mid-range Android phone on Egyptian mobile data,
 * opening a link inside WhatsApp's in-app browser, while five friends wait. On
 * that connection a quarter-megabyte of JavaScript is several seconds of blank
 * screen, and a blank screen at that moment is somebody going back to the chat
 * to say "it's not working".
 *
 * A player only ever needs one game's code: the one their party is playing.
 * Splitting per route means they download that one, and the cost of adding a
 * fifteenth game stops being paid by everyone who plays the other fourteen.
 *
 * The three eager imports are the pages a cold visitor can reach without a
 * socket connection — the landing page, the invite link, and 404. Lazy-loading
 * those would put a network round-trip on the critical path for no benefit.
 */
const lazyPage = (loader: () => Promise<{ default: ComponentType }>) => lazy(loader);

const Index = lazyPage(() => import("./pages/index"));
const Room = lazyPage(() => import("./pages/Room"));
const Game = lazyPage(() => import("./pages/Game"));
const PartyHub = lazyPage(() => import("./pages/party/PartyHub"));

const CodenamesHome = lazyPage(() => import("./pages/codenames/CodenamesHome"));
const CodenamesRoom = lazyPage(() => import("./pages/codenames/CodenamesRoom"));
const CodenamesGame = lazyPage(() => import("./pages/codenames/CodenamesGame"));

const HigherLowerHome = lazyPage(() => import("./pages/higher-lower/HigherLowerHome"));
const HigherLowerRoom = lazyPage(() => import("./pages/higher-lower/HigherLowerRoom"));
const HigherLowerGame = lazyPage(() => import("./pages/higher-lower/HigherLowerGame"));

const DominoHome = lazyPage(() => import("./pages/domino/DominoHome"));
const DominoRoom = lazyPage(() => import("./pages/domino/DominoRoom"));
const DominoGame = lazyPage(() => import("./pages/domino/DominoGame"));

const SpyfallHome = lazyPage(() => import("./pages/spyfall/SpyfallHome"));
const SpyfallGamePage = lazyPage(() => import("./pages/spyfall/SpyfallGame"));

const ChameleonHome = lazyPage(() => import("./pages/chameleon/ChameleonHome"));
const ChameleonGamePage = lazyPage(() => import("./pages/chameleon/ChameleonGame"));

const WyrHome = lazyPage(() => import("./pages/wyr/WyrHome"));
const WyrGamePage = lazyPage(() => import("./pages/wyr/WyrGame"));

const RentoHome = lazyPage(() => import("./pages/rento/RentoHome"));
const RentoRoom = lazyPage(() => import("./pages/rento/RentoRoom"));
const RentoGame = lazyPage(() => import("./pages/rento/RentoGame"));

const LobbyHome = lazyPage(() => import("./pages/lobby/LobbyHome"));
const LobbyRoom = lazyPage(() => import("./pages/lobby/LobbyRoom"));

const ArcadeHub = lazyPage(() => import("./pages/arcade/ArcadeHub"));
const SnakeGame = lazyPage(() => import("./pages/arcade/SnakeGame"));
const TicTacToeGame = lazyPage(() => import("./pages/arcade/TicTacToeGame"));
const FighterGame = lazyPage(() => import("./pages/arcade/FighterGame"));
const JumperGame = lazyPage(() => import("./pages/arcade/JumperGame"));
const SpaceInvadersGame = lazyPage(() => import("./pages/arcade/SpaceInvadersGame"));
const SpaceAlienGame = lazyPage(() => import("./pages/arcade/SpaceAlienGame"));
const MemoryPuzzleGame = lazyPage(() => import("./pages/arcade/MemoryPuzzleGame"));
const TetrisGame = lazyPage(() => import("./pages/arcade/TetrisGame"));

const queryClient = new QueryClient();

/**
 * What a player sees while a route's chunk downloads.
 *
 * A skeleton rather than a spinner, deliberately. A spinner says "something is
 * happening"; a skeleton says "something is happening AND here is its shape",
 * and on a slow connection that difference is what stops someone deciding the
 * page is broken. It also occupies the layout the real page will, so arrival
 * doesn't shift everything.
 */
function RouteFallback() {
  return (
    <div className="page max-w-2xl mx-auto" aria-busy="true" aria-live="polite">
      <div className="skeleton h-9 w-32 rounded-lg mb-6" />
      <div className="skeleton h-44 rounded-xl mb-3" />
      <div className="skeleton h-28 rounded-xl" />
    </div>
  );
}

function ToastRenderer() {
  const { toasts } = useGame();
  const lastToastRef = useRef<string | null>(null);

  useEffect(() => {
    if (toasts.length === 0) return;
    const last = toasts[toasts.length - 1];
    if (last.id === lastToastRef.current) return;
    lastToastRef.current = last.id;

    switch (last.type) {
      case "error":
        toast.error(last.message);
        break;
      case "success":
        toast.success(last.message);
        break;
      case "challenge":
        toast(last.message, {
          style: {
            background:
              "linear-gradient(90deg, hsl(var(--coral) / 0.92), hsl(var(--gold) / 0.8))",
            border: "1px solid hsl(var(--coral) / 0.5)",
            color: "#fff",
          },
        });
        break;
      default:
        toast(last.message);
    }
  }, [toasts]);

  return null;
}

const App = () => (
  <LanguageProvider>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <GameProvider>
          {/* Above the router on purpose: route changes must not tear down voice. */}
          <VoiceProvider>
            <BrowserRouter>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Landing />} />

                  {/* The party is the durable room; /j/:code is the short invite
                      link every WhatsApp message carries. */}
                  <Route path="/r/:roomId" element={<PartyHub />} />
                  <Route path="/j/:roomId" element={<JoinParty />} />

                  <Route path="/play" element={<Index />} />
                  <Route path="/room/:roomId" element={<Room />} />
                  <Route path="/game/:roomId" element={<Game />} />

                  <Route path="/codenames" element={<CodenamesHome />} />
                  <Route path="/codenames/room/:roomId" element={<CodenamesRoom />} />
                  <Route path="/codenames/game/:roomId" element={<CodenamesGame />} />

                  <Route path="/higher-lower" element={<HigherLowerHome />} />
                  <Route path="/higher-lower/room/:roomId" element={<HigherLowerRoom />} />
                  <Route path="/higher-lower/game/:roomId" element={<HigherLowerGame />} />

                  <Route path="/domino" element={<DominoHome />} />
                  <Route path="/domino/room/:roomId" element={<DominoRoom />} />
                  <Route path="/domino/game/:roomId" element={<DominoGame />} />

                  <Route path="/spyfall" element={<SpyfallHome />} />
                  <Route path="/spyfall/game/:roomId" element={<SpyfallGamePage />} />

                  <Route path="/chameleon" element={<ChameleonHome />} />
                  <Route path="/chameleon/game/:roomId" element={<ChameleonGamePage />} />

                  <Route path="/wyr" element={<WyrHome />} />
                  <Route path="/wyr/game/:roomId" element={<WyrGamePage />} />

                  <Route path="/rento" element={<RentoHome />} />
                  <Route path="/rento/room/:roomId" element={<RentoRoom />} />
                  <Route path="/rento/game/:roomId" element={<RentoGame />} />

                  <Route path="/lobby" element={<LobbyHome />} />
                  <Route path="/lobby/:roomId" element={<LobbyRoom />} />

                  <Route path="/arcade" element={<ArcadeHub />} />
                  <Route path="/arcade/snake" element={<SnakeGame />} />
                  <Route path="/arcade/tictactoe" element={<TicTacToeGame />} />
                  <Route path="/arcade/fighter" element={<FighterGame />} />
                  <Route path="/arcade/jumper" element={<JumperGame />} />
                  <Route path="/arcade/space-invaders" element={<SpaceInvadersGame />} />
                  <Route path="/arcade/space-alien" element={<SpaceAlienGame />} />
                  <Route path="/arcade/memory-puzzle" element={<MemoryPuzzleGame />} />
                  <Route path="/arcade/tetris" element={<TetrisGame />} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>

              {/* Mounted outside <Routes> on purpose: every game page inherits
                  invite / switch-game / rematch / mic without knowing the dock
                  exists, so no game can ship without a way back to the hub. */}
              <PartyDock />
              {/* Follows the party into whatever game the host switches to.
                  Mounted here, not in PartyHub: the dock can switch games from
                  any page, so the follower has to live where the dock does. */}
              <PartyRouter />
              {/* Full-screen, because everything behind it is stale. */}
              <SupersededNotice />
            </BrowserRouter>
          </VoiceProvider>
          <ToastRenderer />
          <Toaster position="top-center" richColors closeButton />
        </GameProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </LanguageProvider>
);

export default App;
