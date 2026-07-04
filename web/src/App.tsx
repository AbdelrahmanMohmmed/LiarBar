import { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GameProvider, useGame } from "@/lib/gameContext";
import { toast } from "sonner";
import Index from "./pages/index";
import Room from "./pages/Room";
import Game from "./pages/Game";
import NotFound from "./pages/NotFound";

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
  <QueryClientProvider client={queryClient}>
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/game/:roomId" element={<Game />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <ToastRenderer />
    </GameProvider>
  </QueryClientProvider>
);

export default App;
