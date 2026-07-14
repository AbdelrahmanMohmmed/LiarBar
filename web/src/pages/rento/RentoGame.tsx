import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { HelpCircle, ArrowLeft } from "lucide-react";
import RentoLobbyGame from "@/pages/lobby/games/RentoLobbyGame";

const HOW_TO = {
  ar: {
    back: "الرئيسية",
    leave: "مغادرة",
    chat: "المحادثة",
    helpTitle: "كيف تلعب رينتو؟",
    help: "1. اضغط ارمي النرد لتتحرك حول اللوحة.\n2. إذا وقفت على مدينة غير مملوكة، اشترِها.\n3. إذا وقفت على مدينة لخصم، ادفع له الإيجار.\n4. تستطيع التبادل مع اللاعبين الآخرين (عقارات أو مال).\n5. إذا حصلت على رقمين متطابقين (دبل)، ارمِ مرة أخرى.\n6. تنتهي اللعبة عندما يُفلس جميع الخصوم ما عدا واحد!",
    howGot: "مفاتيح التحكم",
    controls: "الكمبيوتر: أسهم المفاتيح للتحرك، مسافة للنرد. الهاتف: استخدم أزرار الشاشة.",
  },
  en: {
    back: "Home",
    leave: "Leave",
    chat: "Chat",
    helpTitle: "How to play Rento?",
    help: "1. Press Roll Dice to move around the board.\n2. If you land on an unowned city, buy it.\n3. If you land on a rival's city, pay them rent.\n4. You can trade with other players (properties or money).\n5. Roll doubles (same two dice) to roll again.\n6. The game ends when every rival but one goes bankrupt!",
    howGot: "Controls",
    controls: "Keyboard: arrow keys to move, Space to roll. Phone: use the on-screen buttons.",
  },
} as const;

export default function RentoGame() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    rentoState, myPlayerId, resetGame,
  } = useGame();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const c = HOW_TO[isAr ? "ar" : "en"];
  const dir = isAr ? "rtl" : "ltr";
  const textAlign = isAr ? "right" : "left";

  const [showHelp, setShowHelp] = useState(false);

  const handleLeave = useCallback(() => {
    resetGame();
    localStorage.removeItem("liarsbar_roomId");
    localStorage.removeItem("liarsbar_playerId");
    navigate("/rento");
  }, [resetGame, navigate]);

  if (!rentoState) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0b0710",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        fontFamily: "system-ui, sans-serif",
      }}>
        <p style={{ color: "#fff" }}>Reconnecting to game room...</p>
        <button
          onClick={() => navigate("/rento")}
          style={{
            border: "2px solid #fff",
            background: "transparent",
            color: "#fff",
            borderRadius: 999,
            padding: "8px 14px",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          {c.back}
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#0b0710" }}>
      {/* Top navbar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 16px",
          background: "rgba(0,0,0,0.6)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(5px)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={handleLeave}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              borderRadius: 999,
              padding: "6px 12px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            <ArrowLeft size={16} />
            {c.leave}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setShowHelp(true)}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              padding: 4,
            }}
            aria-label="Help"
          >
            <HelpCircle size={18} />
          </button>
        </div>
      </div>

      {/* Board */}
      <RentoLobbyGame state={rentoState} myPlayerId={myPlayerId ?? undefined} />

      {/* Help Modal */}
      {showHelp && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 400,
            padding: 16,
          }}
          onClick={() => setShowHelp(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 450,
              padding: 24,
              background: "#fff",
              color: "#2B2420",
              borderRadius: 24,
              border: "3px solid #2B2420",
              boxShadow: "6px 6px 0 #2B2420",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 16px 0", textAlign }}>
              {c.helpTitle}
            </h2>
            <div style={{ whiteSpace: "pre-line", fontSize: 14, lineHeight: 1.7, color: "#5B5147", marginBottom: 16, textAlign }}>
              {c.help}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2B2420", marginBottom: 6, textAlign }}>{c.howGot}</div>
            <div style={{ fontSize: 13, color: "#5B5147", textAlign }}>{c.controls}</div>
            <div style={{ marginTop: 24, textAlign: "center" }}>
              <button
                onClick={() => setShowHelp(false)}
                style={{
                  background: "#E8574A",
                  color: "#fff",
                  border: "none",
                  borderRadius: 999,
                  padding: "10px 24px",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {isAr ? "موافق" : "Got it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
