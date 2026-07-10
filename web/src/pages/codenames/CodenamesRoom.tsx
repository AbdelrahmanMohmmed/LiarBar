import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import type { CodenamesRole, CodenamesTeam } from "@/lib/types";
import { COLORS, uiFont } from "./theme";
import { Panel, Field, PrimaryButton, inputStyle } from "./ui";

const COPY = {
  ar: {
    back: "الرئيسية",
    leave: "مغادرة",
    roomLabel: "الغرفة",
    copy: "نسخ",
    copied: "تم نسخ رمز الغرفة!",
    players: "لاعبون",
    redTeam: "الفريق الأحمر",
    tealTeam: "الفريق الأزرق المخضرّ",
    noTeam: "بدون فريق",
    spymaster: "قائد التلميح",
    operative: "مخمّن",
    joinAsSpymaster: "انضم كقائد",
    joinAsOperative: "انضم كمخمّن",
    emptySeat: "شاغر",
    you: "أنت",
    host: "المضيف",
    disconnected: "غير متصل",
    startGame: "ابدأ اللعبة",
    starting: "جارٍ البدء...",
    needTeams: "كل فريق يحتاج قائداً ومخمّناً واحداً على الأقل",
    needMorePlayers: "تحتاج 4 لاعبين على الأقل",
    waitingForHost: "بانتظار أن يبدأ المضيف اللعبة…",
    joinTitle: "انضم إلى الغرفة",
    joinDesc: "رمز الغرفة",
    yourName: "اسمك",
    namePlaceholder: "اكتب اسمك",
    joinButton: "انضمام",
    joining: "جارٍ الانضمام...",
    nameRequired: "اكتب اسمك أولاً",
    backHome: "الرجوع للرئيسية",
  },
  en: {
    back: "Home",
    leave: "Leave",
    roomLabel: "Room",
    copy: "Copy",
    copied: "Room code copied!",
    players: "players",
    redTeam: "Red team",
    tealTeam: "Teal team",
    noTeam: "No team",
    spymaster: "Spymaster",
    operative: "Operative",
    joinAsSpymaster: "Join as spymaster",
    joinAsOperative: "Join as operative",
    emptySeat: "Empty",
    you: "you",
    host: "host",
    disconnected: "offline",
    startGame: "Start game",
    starting: "Starting...",
    needTeams: "Each team needs a spymaster and at least one operative",
    needMorePlayers: "Need at least 4 players",
    waitingForHost: "Waiting for the host to start the game…",
    joinTitle: "Join the room",
    joinDesc: "Room code",
    yourName: "Your name",
    namePlaceholder: "Enter your name",
    joinButton: "Join",
    joining: "Joining...",
    nameRequired: "Enter your name first",
    backHome: "Back to home",
  },
} as const;

export default function CodenamesRoom() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    codenamesState, myPlayerId, myRoomId, joinRoom, reconnectRoom,
    codenamesJoinTeam, startGame, addToast,
  } = useGame();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const c = COPY[isAr ? "ar" : "en"];
  const dir = isAr ? "rtl" : "ltr";
  const font = uiFont(isAr);
  const textAlign = isAr ? "right" : "left";

  const [reconnected, setReconnected] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [starting, setStarting] = useState(false);

  const isInRoom = myPlayerId && codenamesState?.players.some((p) => p.id === myPlayerId);

  useEffect(() => {
    if (reconnected) return;
    const storedRoomId = localStorage.getItem("liarsbar_roomId");
    const storedPlayerId = localStorage.getItem("liarsbar_playerId");

    if (storedRoomId === paramRoomId && storedPlayerId && !codenamesState) {
      reconnectRoom(storedRoomId, storedPlayerId)
        .then(() => setReconnected(true))
        .catch(() => setReconnected(true));
    } else if (paramRoomId === myRoomId && isInRoom) {
      setReconnected(true);
    } else if (!codenamesState && !storedPlayerId) {
      setReconnected(true);
    }
  }, [paramRoomId, myRoomId, codenamesState, reconnectRoom, reconnected, isInRoom]);

  useEffect(() => {
    if (codenamesState && codenamesState.phase !== "lobby") {
      navigate(`/codenames/game/${paramRoomId}`);
    }
  }, [codenamesState, paramRoomId, navigate]);

  const handleJoinRoom = useCallback(async () => {
    if (!joinName.trim()) {
      addToast(c.nameRequired, "error");
      return;
    }
    setIsJoining(true);
    try {
      await joinRoom(paramRoomId!, joinName.trim());
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to join room", "error");
    } finally {
      setIsJoining(false);
    }
  }, [joinName, paramRoomId, joinRoom, addToast, c]);

  const handleJoinTeam = useCallback(
    async (team: CodenamesTeam, role: CodenamesRole) => {
      try {
        await codenamesJoinTeam(team, role);
      } catch (err) {
        addToast(err instanceof Error ? err.message : "Failed to join team", "error");
      }
    },
    [codenamesJoinTeam, addToast],
  );

  const copyRoomCode = useCallback(() => {
    if (!paramRoomId) return;
    navigator.clipboard.writeText(paramRoomId).then(() => addToast(c.copied, "success"));
  }, [paramRoomId, addToast, c]);

  const handleStart = useCallback(async () => {
    setStarting(true);
    try {
      await startGame();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to start game", "error");
    } finally {
      setStarting(false);
    }
  }, [startGame, addToast]);

  if (!codenamesState || !isInRoom) {
    return (
      <div
        dir={dir}
        style={{
          minHeight: "100vh",
          background: COLORS.cream,
          color: COLORS.ink,
          fontFamily: font,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div style={{ width: "100%", maxWidth: 380 }}>
          <Panel style={{ padding: 20 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>{c.joinTitle}</h2>
            <p style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 16 }}>
              {c.joinDesc}: <span style={{ fontWeight: 700 }}>{paramRoomId}</span>
            </p>
            <Field label={c.yourName} align={textAlign}>
              <input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder={c.namePlaceholder}
                maxLength={16}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJoinRoom();
                }}
                style={inputStyle(textAlign)}
              />
            </Field>
            <PrimaryButton onClick={handleJoinRoom} disabled={isJoining} color={COLORS.teal}>
              {isJoining ? c.joining : c.joinButton}
            </PrimaryButton>
            <button
              onClick={() => navigate("/")}
              style={{
                width: "100%",
                marginTop: 12,
                background: "transparent",
                border: "none",
                color: COLORS.textMuted,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {c.backHome}
            </button>
          </Panel>
        </div>
      </div>
    );
  }

  const assignments = codenamesState.assignments;
  const players = codenamesState.players;
  const me = players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost === true;

  const teamMembers = (team: CodenamesTeam | null, role?: CodenamesRole) =>
    players.filter((p) => {
      const a = assignments[p.id];
      const t = a?.team ?? null;
      if (t !== team) return false;
      if (role && a?.role !== role) return false;
      return true;
    });

  const startIssue = (() => {
    if (players.length < 4) return c.needMorePlayers;
    if (players.some((p) => !assignments[p.id]?.team)) return c.needTeams;
    for (const team of ["red", "teal"] as CodenamesTeam[]) {
      const spy = teamMembers(team, "spymaster");
      const ops = teamMembers(team, "operative");
      if (spy.length !== 1 || ops.length < 1) return c.needTeams;
    }
    return null;
  })();

  return (
    <div
      dir={dir}
      style={{
        minHeight: "100vh",
        background: COLORS.cream,
        color: COLORS.ink,
        fontFamily: font,
        padding: "20px 16px 40px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <button
            onClick={() => navigate("/")}
            style={{
              border: `2px solid ${COLORS.ink}`,
              background: COLORS.white,
              color: COLORS.ink,
              fontFamily: "'Baloo 2', sans-serif",
              fontWeight: 700,
              fontSize: 13,
              padding: "8px 14px",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            {isAr ? `${c.leave} ←` : `← ${c.leave}`}
          </button>

          <button
            onClick={copyRoomCode}
            style={{
              border: `2px dashed ${COLORS.ink}`,
              background: COLORS.white,
              color: COLORS.ink,
              fontFamily: "'Baloo 2', sans-serif",
              fontWeight: 700,
              fontSize: 14,
              padding: "8px 16px",
              borderRadius: 999,
              cursor: "pointer",
              letterSpacing: 2,
            }}
            title={c.copy}
          >
            {c.roomLabel}: {codenamesState.roomId}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 16,
          }}
          className="cn-lobby-grid"
        >
          <TeamPanel
            title={c.redTeam}
            color={COLORS.red}
            spymaster={teamMembers("red", "spymaster")[0]}
            operatives={teamMembers("red", "operative")}
            myPlayerId={myPlayerId}
            copy={c}
            textAlign={textAlign}
            onJoinSpymaster={() => handleJoinTeam("red", "spymaster")}
            onJoinOperative={() => handleJoinTeam("red", "operative")}
          />

          <Panel style={{ padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, textAlign }}>{c.noTeam}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {teamMembers(null).map((p) => (
                <PlayerChip key={p.id} name={p.name} isYou={p.id === myPlayerId} isHost={p.isHost} connected={p.isConnected} copy={c} />
              ))}
              {teamMembers(null).length === 0 && (
                <p style={{ color: COLORS.textMuted, fontSize: 13, textAlign }}>—</p>
              )}
            </div>
          </Panel>

          <TeamPanel
            title={c.tealTeam}
            color={COLORS.teal}
            spymaster={teamMembers("teal", "spymaster")[0]}
            operatives={teamMembers("teal", "operative")}
            myPlayerId={myPlayerId}
            copy={c}
            textAlign={textAlign}
            onJoinSpymaster={() => handleJoinTeam("teal", "spymaster")}
            onJoinOperative={() => handleJoinTeam("teal", "operative")}
          />
        </div>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          {isHost ? (
            <>
              <PrimaryButton onClick={handleStart} disabled={starting || !!startIssue} color={COLORS.teal} style={{ maxWidth: 320, margin: "0 auto" }}>
                {starting ? c.starting : c.startGame}
              </PrimaryButton>
              {startIssue && (
                <p style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 8 }}>{startIssue}</p>
              )}
            </>
          ) : (
            <p style={{ color: COLORS.textMuted, fontSize: 14 }}>{c.waitingForHost}</p>
          )}
        </div>
      </div>

      <style>{`
        @media (min-width: 720px) {
          .cn-lobby-grid { grid-template-columns: 1fr 0.8fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}

interface Copy {
  spymaster: string;
  operative: string;
  joinAsSpymaster: string;
  joinAsOperative: string;
  emptySeat: string;
  you: string;
  host: string;
  disconnected: string;
}

function TeamPanel({
  title,
  color,
  spymaster,
  operatives,
  myPlayerId,
  copy,
  textAlign,
  onJoinSpymaster,
  onJoinOperative,
}: {
  title: string;
  color: string;
  spymaster: { id: string; name: string; isHost: boolean; isConnected: boolean } | undefined;
  operatives: { id: string; name: string; isHost: boolean; isConnected: boolean }[];
  myPlayerId: string | null;
  copy: Copy;
  textAlign: "left" | "right";
  onJoinSpymaster: () => void;
  onJoinOperative: () => void;
}) {
  const iAmSpymaster = spymaster?.id === myPlayerId;
  const iAmOperative = operatives.some((p) => p.id === myPlayerId);

  return (
    <Panel style={{ overflow: "hidden" }}>
      <div style={{ background: color, color: COLORS.cream, padding: "12px 16px", fontWeight: 800, fontSize: 16, textAlign }}>
        {title}
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6, textAlign }}>{copy.spymaster} ♦</div>
          {spymaster ? (
            <PlayerChip name={spymaster.name} isYou={spymaster.id === myPlayerId} isHost={spymaster.isHost} connected={spymaster.isConnected} copy={copy} />
          ) : (
            <button
              onClick={onJoinSpymaster}
              disabled={iAmSpymaster}
              style={{
                width: "100%",
                textAlign,
                padding: "8px 12px",
                borderRadius: 10,
                border: `2px dashed ${COLORS.disabledText}`,
                background: "transparent",
                color: COLORS.textSecondary,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {copy.joinAsSpymaster}
            </button>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6, textAlign }}>{copy.operative}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {operatives.map((p) => (
              <PlayerChip key={p.id} name={p.name} isYou={p.id === myPlayerId} isHost={p.isHost} connected={p.isConnected} copy={copy} />
            ))}
            {!iAmOperative && (
              <button
                onClick={onJoinOperative}
                style={{
                  width: "100%",
                  textAlign,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: `2px dashed ${COLORS.disabledText}`,
                  background: "transparent",
                  color: COLORS.textSecondary,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {copy.joinAsOperative}
              </button>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function PlayerChip({
  name,
  isYou,
  isHost,
  connected,
  copy,
}: {
  name: string;
  isYou: boolean;
  isHost: boolean;
  connected: boolean;
  copy: Copy;
}) {
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        background: COLORS.peach,
        fontSize: 14,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        gap: 6,
        opacity: connected ? 1 : 0.5,
      }}
    >
      {name}
      {isHost && " ♦"}
      {isYou && <span style={{ fontWeight: 400, fontSize: 12, color: COLORS.textSecondary }}>({copy.you})</span>}
      {!connected && <span style={{ fontWeight: 400, fontSize: 11, color: COLORS.textMuted }}>· {copy.disconnected}</span>}
    </div>
  );
}
