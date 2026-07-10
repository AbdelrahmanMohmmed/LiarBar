import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";
import { ArrowLeft, Users, Sparkles, LogIn, Plus } from "lucide-react";

const COPY = {
  ar: {
    back: "الرئيسية",
    title: "وضع اللوبي",
    subtitle: "أنشئ غرفة تجمع مع أصدقائك، وتحدث معهم بالصوت، والعب أي لعبة معاً!",
    yourName: "اسمك",
    namePlaceholder: "اكتب اسمك",
    createTab: "إنشاء لوبي",
    joinTab: "الانضمام للوبي",
    playerCount: "عدد اللاعبين الأقصى",
    createButton: "إنشاء اللوبي",
    creating: "جارٍ الإنشاء...",
    roomCode: "رمز الغرفة",
    roomCodePlaceholder: "مثال: 123456",
    joinButton: "انضمام",
    joining: "جارٍ الانضمام...",
    nameRequired: "اكتب اسمك أولاً",
    codeRequired: "اكتب رمز الغرفة",
  },
  en: {
    back: "Home",
    title: "Lobby Mode",
    subtitle: "Create a persistent room with friends, talk over voice, and play any game together!",
    yourName: "Your name",
    namePlaceholder: "Enter your name",
    createTab: "Create Lobby",
    joinTab: "Join Lobby",
    playerCount: "Max Players",
    createButton: "Create Lobby",
    creating: "Creating...",
    roomCode: "Room code",
    roomCodePlaceholder: "e.g. 123456",
    joinButton: "Join",
    joining: "Joining...",
    nameRequired: "Enter your name first",
    codeRequired: "Enter a room code",
  },
} as const;

export default function LobbyHome() {
  const navigate = useNavigate();
  const { createRoom, joinRoom, addToast } = useGame();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const c = COPY[isAr ? "ar" : "en"];
  const dir = isAr ? "rtl" : "ltr";

  const [tab, setTab] = useState<"create" | "join">("create");
  const [playerName, setPlayerName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("10");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!playerName.trim()) {
      addToast(c.nameRequired, "error");
      return;
    }
    setIsLoading(true);
    try {
      const { roomId } = await createRoom(
        playerName.trim(),
        parseInt(maxPlayers, 10),
        "cards",
        2,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        "lobby"
      );
      navigate(`/lobby/${roomId}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to create lobby", "error");
    } finally {
      setIsLoading(false);
    }
  }, [playerName, maxPlayers, createRoom, navigate, addToast, c]);

  const handleJoin = useCallback(async () => {
    if (!playerName.trim()) {
      addToast(c.nameRequired, "error");
      return;
    }
    if (!joinRoomId.trim()) {
      addToast(c.codeRequired, "error");
      return;
    }
    setIsLoading(true);
    try {
      await joinRoom(joinRoomId.trim(), playerName.trim());
      navigate(`/lobby/${joinRoomId.trim().toUpperCase()}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to join lobby", "error");
    } finally {
      setIsLoading(false);
    }
  }, [playerName, joinRoomId, joinRoom, navigate, addToast, c]);

  return (
    <>
      <Seo
        lang={isAr ? "ar" : "en"}
        title={isAr ? "وضع اللوبي — غرفة التجمع أونلاين" : "Lobby Mode — Online Party Hub"}
        description={
          isAr
            ? "أنشئ غرفة تجمع دائمة لأصدقائك، وتحدث معهم بالصوت، والعب أي لعبة. مجاناً وبدون تحميل."
            : "Create a persistent party lobby with friends — play card games, chat via voice, and switch games seamlessly. Free, no download."
        }
        path="/lobby"
      />
      <div
        dir={dir}
        className="min-h-screen bg-gradient-to-b from-[#110617] via-[#1a0924] to-[#110617] flex flex-col items-center justify-center p-4 text-purple-100"
      >
        <button
          onClick={() => navigate("/")}
          className="absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 text-purple-300/50 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-purple-950/40 transition-all font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          {c.back}
        </button>

        <div className="w-full max-w-md bg-[#1d0d29]/95 border border-purple-900/35 shadow-2xl rounded-2xl p-6 space-y-6 relative z-10">
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent uppercase tracking-wider">
              {c.title}
            </h1>
            <p className="text-purple-300/60 text-xs px-2 leading-relaxed">
              {c.subtitle}
            </p>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 p-1 bg-[#251034] rounded-xl border border-purple-950/30">
            <button
              onClick={() => setTab("create")}
              className={`py-2 px-3 text-center rounded-lg text-xs font-bold transition-all uppercase ${
                tab === "create" ? "bg-purple-600 text-white shadow" : "text-purple-300 hover:text-white"
              }`}
            >
              {c.createTab}
            </button>
            <button
              onClick={() => setTab("join")}
              className={`py-2 px-3 text-center rounded-lg text-xs font-bold transition-all uppercase ${
                tab === "join" ? "bg-purple-600 text-white shadow" : "text-purple-300 hover:text-white"
              }`}
            >
              {c.joinTab}
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="playerName" className="text-purple-200/80 text-xs font-bold block">
                {c.yourName}
              </label>
              <input
                id="playerName"
                placeholder={c.namePlaceholder}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={16}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#2a1338] border border-purple-900/40 text-white placeholder:text-purple-200/20 focus:border-purple-500 focus:outline-none text-sm"
              />
            </div>

            {tab === "create" ? (
              <div className="space-y-1">
                <label htmlFor="maxPlayers" className="text-purple-200/80 text-xs font-bold block">
                  {c.playerCount}
                </label>
                <select
                  id="maxPlayers"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#2a1338] border border-purple-900/40 text-white focus:outline-none text-sm"
                >
                  <option value="4">4 Players</option>
                  <option value="6">6 Players</option>
                  <option value="8">8 Players</option>
                  <option value="10">10 Players</option>
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <label htmlFor="joinRoomId" className="text-purple-200/80 text-xs font-bold block">
                  {c.roomCode}
                </label>
                <input
                  id="joinRoomId"
                  placeholder={c.roomCodePlaceholder}
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  maxLength={10}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#2a1338] border border-purple-900/40 text-white placeholder:text-purple-200/20 focus:border-purple-500 focus:outline-none text-sm"
                />
              </div>
            )}

            <button
              onClick={tab === "create" ? handleCreate : handleJoin}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-purple-900/20 transition-all active:scale-95 disabled:opacity-50 text-sm uppercase"
            >
              {tab === "create" ? (
                <>
                  <Plus className="w-4 h-4" />
                  {isLoading ? c.creating : c.createButton}
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  {isLoading ? c.joining : c.joinButton}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
