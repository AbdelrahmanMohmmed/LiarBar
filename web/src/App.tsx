import { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GameProvider, useGame } from "@/lib/gameContext";
import { LanguageProvider } from "@/lib/languageContext";
import { ThemeProvider } from "@/lib/themeContext";
import { toast, Toaster } from "sonner";
import Landing from "./pages/Landing";
import Index from "./pages/index";
import Room from "./pages/Room";
import Game from "./pages/Game";
import CodenamesHome from "./pages/codenames/CodenamesHome";
import CodenamesRoom from "./pages/codenames/CodenamesRoom";
import CodenamesGame from "./pages/codenames/CodenamesGame";
import HigherLowerHome from "./pages/higher-lower/HigherLowerHome";
import HigherLowerRoom from "./pages/higher-lower/HigherLowerRoom";
import HigherLowerGame from "./pages/higher-lower/HigherLowerGame";
import LobbyHome from "./pages/lobby/LobbyHome";
import LobbyRoom from "./pages/lobby/LobbyRoom";
import NotFound from "./pages/NotFound";
import ArcadeHub from "./pages/arcade/ArcadeHub";
import SnakeGame from "./pages/arcade/SnakeGame";
import TicTacToeGame from "./pages/arcade/TicTacToeGame";
import FighterGame from "./pages/arcade/FighterGame";
import JumperGame from "./pages/arcade/JumperGame";
import SpaceInvadersGame from "./pages/arcade/SpaceInvadersGame";
import SpaceAlienGame from "./pages/arcade/SpaceAlienGame";

const queryClient = new QueryClient();

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
            background: "linear-gradient(to right, #991b1b, #92400e)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            color: "white",
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
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/play" element={<Index />} />
            <Route path="/room/:roomId" element={<Room />} />
            <Route path="/game/:roomId" element={<Game />} />
            <Route path="/codenames" element={<CodenamesHome />} />
            <Route path="/codenames/room/:roomId" element={<CodenamesRoom />} />
            <Route path="/codenames/game/:roomId" element={<CodenamesGame />} />
            <Route path="/higher-lower" element={<HigherLowerHome />} />
            <Route path="/higher-lower/room/:roomId" element={<HigherLowerRoom />} />
            <Route path="/higher-lower/game/:roomId" element={<HigherLowerGame />} />
            <Route path="/lobby" element={<LobbyHome />} />
            <Route path="/lobby/:roomId" element={<LobbyRoom />} />
            <Route path="/arcade" element={<ArcadeHub />} />
            <Route path="/arcade/snake" element={<SnakeGame />} />
            <Route path="/arcade/tictactoe" element={<TicTacToeGame />} />
            <Route path="/arcade/fighter" element={<FighterGame />} />
            <Route path="/arcade/jumper" element={<JumperGame />} />
            <Route path="/arcade/space-invaders" element={<SpaceInvadersGame />} />
            <Route path="/arcade/space-alien" element={<SpaceAlienGame />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <ToastRenderer />
        <Toaster position="top-center" richColors closeButton />
    </GameProvider>
  </QueryClientProvider>
  </ThemeProvider>
  </LanguageProvider>
);

export default App;
