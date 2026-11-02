import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { COLORS, uiFont } from "@/pages/domino/theme";
import { Panel, PrimaryButton, SecondaryButton } from "@/pages/domino/ui";
import { PIECE_ICONS } from "@/lib/pieceIcons";

/**
 * Rento's settings page.
 *
 * The rules here are the same ones Rento's setup route offers — starting
 * balance, jail, free parking, turn timer, map, background and bot difficulty —
 * copying that page rather than inventing a second set. The difference is the
 * audience: this page edits the rules of the party game already staged, so it
 * writes them back with `party_update_options` and they apply when the host
 * starts the deal. Once a game is running the rules are read-only, because the
 * engine took them in its constructor.
 *
 * Flag style and your board piece are personal, stored on this device, and safe
 * for anyone to change at any time.
 */

const COPY = {
  ar: {
    back: "رجوع",
    title: "إعدادات رينتو",
    subtitle: "قواعد الغرفة زي شاشة الإنشاء، وشكل الأعلام وقطعتك انت اللي بتختارهم.",
    rules: "قواعد الغرفة",
    startingBalance: "رأس المال الابتدائي",
    jail: "السجن",
    freeParking: "جائزة الوقوف المجاني",
    turnTimer: "وقت الدور",
    aiDifficulty: "ذكاء البوتات",
    map: "الخريطة",
    mapMiddleEast: "الشرق الأوسط",
    mapEurope: "أوروبا",
    mapAmericas: "الأمريكتين",
    background: "الخلفية",
    bgNebula: "سديم",
    bgOcean: "محيط",
    bgSunset: "غروب",
    bgEmerald: "زمردي",
    on: "مفعل",
    off: "معطل",
    seconds: "ثانية",
    appearance: "الشكل",
    flagStyle: "شكل الأعلام",
    flagCss: "رسم",
    flagImage: "صورة حقيقية",
    yourPiece: "قطعتك",
    rulesLiveHint: "القواعد دي متقفلة على الجولة الحالية. غيّرها قبل ما اللعبة تبدأ.",
    hostOnly: "صاحب الغرفة بس اللي يقدر يغيّر القواعد.",
    appliesOnStart: "التغيير بيطبق لما اللعبة تبدأ.",
    saved: "تم حفظ الإعدادات",
    saveFailed: "تعذر حفظ الإعدادات",
    notInGame: "مش في لعبة رينتو حالياً.",
    home: "الرئيسية",
    backToGame: "ارجع للعبة",
    backToParty: "ارجع للغرفة",
    easy: "سهل",
    medium: "متوسط",
    hard: "صعب",
  },
  en: {
    back: "Back",
    title: "Rento settings",
    subtitle: "The same rules as the setup screen; the flag style and your piece are yours.",
    rules: "Room rules",
    startingBalance: "Starting balance",
    jail: "Jail",
    freeParking: "Free parking bonus",
    turnTimer: "Turn timer",
    aiDifficulty: "Bot difficulty",
    map: "Map",
    mapMiddleEast: "Middle East",
    mapEurope: "Europe",
    mapAmericas: "Americas",
    background: "Background",
    bgNebula: "Nebula",
    bgOcean: "Ocean",
    bgSunset: "Sunset",
    bgEmerald: "Emerald",
    on: "On",
    off: "Off",
    seconds: "seconds",
    appearance: "Appearance",
    flagStyle: "Flag style",
    flagCss: "Drawn",
    flagImage: "Real",
    yourPiece: "Your piece",
    rulesLiveHint: "These are locked in for the deal in progress. Change them before the game starts.",
    hostOnly: "Only the host can change the rules.",
    appliesOnStart: "Changes apply when the game starts.",
    saved: "Settings saved",
    saveFailed: "Could not save settings",
    notInGame: "You're not in a Rento game right now.",
    home: "Home",
    backToGame: "Back to game",
    backToParty: "Back to the party",
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
  },
} as const;

type Difficulty = "easy" | "medium" | "hard";

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 14px",
        borderRadius: 999,
        border: `2px solid ${COLORS.ink}`,
        background: active ? COLORS.ink : COLORS.white,
        color: active ? COLORS.cream : COLORS.ink,
        fontWeight: 700,
        fontSize: 13,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.75 : 1,
      }}
    >
      {children}
    </button>
  );
}

export default function RentoSettings() {
  const navigate = useNavigate();
  const {
    rentoState,
    partyState,
    myPlayerId,
    partyUpdateOptions,
    setPlayerIcon,
    addToast,
  } = useGame();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const c = COPY[isAr ? "ar" : "en"];
  const dir = isAr ? "rtl" : "ltr";
  const font = uiFont(isAr);
  const textAlign = isAr ? "right" : "left";

  const [flagMode, setFlagMode] = useState<"css" | "image">(() => {
    try {
      return localStorage.getItem("rento_flag_mode") === "css" ? "css" : "image";
    } catch {
      return "image";
    }
  });

  // Same key the board reads, so the choice applies on the very next render.
  const updateFlagMode = useCallback((mode: "css" | "image") => {
    setFlagMode(mode);
    try {
      localStorage.setItem("rento_flag_mode", mode);
    } catch {
      /* private mode: the toggle still works for this visit */
    }
  }, []);

  // Rento staged inside a party publishes its rules as the staged options, so
  // that is the copy the host can still change. A standalone room only has the
  // engine's own values, which are fixed.
  const inParty = partyState?.activeGameId === "rento";
  const staged = Boolean(inParty && partyState?.phase === "hub");
  const isHost = Boolean(
    partyState?.players.find((p) => p.id === myPlayerId)?.isHost,
  );
  const canEdit = Boolean(staged && isHost);
  const opts = (partyState?.activeOptions as Record<string, unknown> | null) ?? {};

  const startingBalance = Number(
    opts.startingBalance ?? rentoState?.startingBalance ?? 1500,
  );
  const jailEnabled =
    opts.jailEnabled !== undefined
      ? Boolean(opts.jailEnabled)
      : (rentoState?.jailEnabled ?? true);
  const freeParking = Number(
    opts.freeParkingBonus ?? rentoState?.freeParkingBonus ?? 0,
  );
  const turnMs = Number(opts.turnTimer ?? rentoState?.turnTimerMs ?? 45000);
  const difficulty = String(
    opts.aiDifficulty ?? rentoState?.aiDifficulty ?? "medium",
  ) as Difficulty;
  const mapId = String(opts.mapId ?? "middle_east");
  const backgroundId = String(opts.backgroundId ?? "nebula");

  const update = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!canEdit) return;
      try {
        await partyUpdateOptions(patch);
        addToast(c.saved, "success");
      } catch (err) {
        addToast(err instanceof Error ? err.message : c.saveFailed, "error");
      }
    },
    [canEdit, partyUpdateOptions, addToast, c.saved, c.saveFailed],
  );

  const roomId = partyState?.roomId ?? rentoState?.roomId ?? null;
  const myIcon = rentoState?.players.find((p) => p.id === myPlayerId)?.icon;
  const turnSec = Math.round(turnMs / 1000);

  const backTo = partyState
    ? `/r/${partyState.roomId}`
    : rentoState
      ? `/rento/game/${rentoState.roomId}`
      : "/rento";

  if (!roomId) {
    return (
      <div
        dir={dir}
        style={{
          minHeight: "100vh",
          background: COLORS.cream,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          fontFamily: font,
          color: COLORS.ink,
          boxSizing: "border-box",
        }}
      >
        <p style={{ margin: 0 }}>{c.notInGame}</p>
        <SecondaryButton onClick={() => navigate("/rento")}>{c.home}</SecondaryButton>
      </div>
    );
  }

  const row = (label: string, value: string, last = false) => (
    <div
      key={label}
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        borderBottom: last ? "none" : "1px solid #E7E1D8",
        paddingBottom: last ? 0 : 8,
      }}
    >
      <span style={{ color: COLORS.textSecondary }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );

  const label = (text: string) => (
    <div style={{ marginBottom: 8, color: COLORS.textSecondary, fontSize: 13, textAlign }}>
      {text}
    </div>
  );

  const mapLabel = (id: string) =>
    id === "europe" ? c.mapEurope : id === "americas" ? c.mapAmericas : c.mapMiddleEast;
  const bgLabel = (id: string) =>
    id === "ocean" ? c.bgOcean : id === "sunset" ? c.bgSunset : id === "emerald" ? c.bgEmerald : c.bgNebula;

  return (
    <div
      dir={dir}
      style={{
        minHeight: "100vh",
        background: COLORS.cream,
        fontFamily: font,
        color: COLORS.ink,
        padding: "24px 16px 40px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: 600, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <button
            onClick={() => navigate(backTo)}
            style={{
              border: `2px solid ${COLORS.ink}`,
              background: COLORS.white,
              color: COLORS.ink,
              fontFamily: font,
              fontWeight: 700,
              fontSize: 14,
              padding: "8px 14px",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            {isAr ? `${c.back} →` : `← ${c.back}`}
          </button>
          <span style={{ fontWeight: 700, letterSpacing: 2 }}>{roomId}</span>
        </div>

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{c.title}</h1>
          <p style={{ color: COLORS.textSecondary, fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
            {c.subtitle}
          </p>
        </div>

        <Panel style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px 0", textAlign }}>
            {c.rules}
          </h2>

          {canEdit ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                {label(c.map)}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(["middle_east", "europe", "americas"] as const).map((id) => (
                    <Chip key={id} active={mapId === id} onClick={() => void update({ mapId: id })}>
                      {mapLabel(id)}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                {label(c.background)}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(["nebula", "ocean", "sunset", "emerald"] as const).map((id) => (
                    <Chip
                      key={id}
                      active={backgroundId === id}
                      onClick={() => void update({ backgroundId: id })}
                    >
                      {bgLabel(id)}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                {label(c.startingBalance)}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[1500, 3000, 6000].map((amt) => (
                    <Chip
                      key={amt}
                      active={startingBalance === amt}
                      onClick={() => void update({ startingBalance: amt })}
                    >
                      ${amt}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                {label(c.jail)}
                <div style={{ display: "flex", gap: 8 }}>
                  <Chip active={jailEnabled} onClick={() => void update({ jailEnabled: true })}>
                    {c.on}
                  </Chip>
                  <Chip active={!jailEnabled} onClick={() => void update({ jailEnabled: false })}>
                    {c.off}
                  </Chip>
                </div>
              </div>

              <div>
                {label(c.freeParking)}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[0, 100, 200, 500].map((amt) => (
                    <Chip
                      key={amt}
                      active={freeParking === amt}
                      onClick={() => void update({ freeParkingBonus: amt })}
                    >
                      {amt === 0 ? c.off : `$${amt}`}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    color: COLORS.textSecondary,
                    fontSize: 13,
                    marginBottom: 6,
                    textAlign,
                  }}
                >
                  <span>{c.turnTimer}</span>
                  <span style={{ fontWeight: 700, color: COLORS.ink }}>
                    {turnSec} {c.seconds}
                  </span>
                </label>
                <input
                  type="range"
                  min={30}
                  max={120}
                  step={5}
                  value={turnSec}
                  onChange={(e) => void update({ turnTimer: Number(e.target.value) * 1000 })}
                  style={{ width: "100%", accentColor: COLORS.teal, cursor: "pointer" }}
                />
              </div>

              <div>
                {label(c.aiDifficulty)}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(["easy", "medium", "hard"] as const).map((level) => (
                    <Chip
                      key={level}
                      active={difficulty === level}
                      onClick={() => void update({ aiDifficulty: level })}
                    >
                      {c[level]}
                    </Chip>
                  ))}
                </div>
              </div>

              <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0, textAlign }}>
                {c.appliesOnStart}
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
                {row(c.map, mapLabel(mapId))}
                {row(c.background, bgLabel(backgroundId))}
                {row(c.startingBalance, `$${startingBalance}`)}
                {row(c.jail, jailEnabled ? c.on : c.off)}
                {row(c.freeParking, freeParking > 0 ? `$${freeParking}` : c.off)}
                {row(c.turnTimer, turnSec > 0 ? `${turnSec} ${c.seconds}` : c.off)}
                {row(c.aiDifficulty, c[difficulty] ?? c.medium, true)}
              </div>
              <p style={{ color: COLORS.textMuted, fontSize: 12, margin: "12px 0 0", textAlign }}>
                {staged ? c.hostOnly : c.rulesLiveHint}
              </p>
            </>
          )}
        </Panel>

        <Panel style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px 0", textAlign }}>
            {c.appearance}
          </h2>
          <div style={{ marginBottom: 6, color: COLORS.textSecondary, fontSize: 13, textAlign }}>
            {c.flagStyle}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            {(["css", "image"] as const).map((mode) => {
              const active = flagMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => updateFlagMode(mode)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: `2px solid ${COLORS.ink}`,
                    background: active ? COLORS.ink : COLORS.white,
                    color: active ? COLORS.cream : COLORS.ink,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {mode === "css" ? c.flagCss : c.flagImage}
                </button>
              );
            })}
          </div>

          <div style={{ marginBottom: 8, color: COLORS.textSecondary, fontSize: 13, textAlign }}>
            {c.yourPiece}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(38px, 1fr))",
              gap: 6,
            }}
          >
            {PIECE_ICONS.map((icon) => {
              const active = myIcon === icon;
              return (
                <button
                  key={icon}
                  onClick={() => setPlayerIcon(icon)}
                  style={{
                    fontSize: 18,
                    padding: "6px 0",
                    borderRadius: 10,
                    border: active ? `2px solid ${COLORS.ink}` : "2px solid transparent",
                    background: active ? COLORS.peach : COLORS.white,
                    cursor: "pointer",
                  }}
                >
                  {icon}
                </button>
              );
            })}
          </div>
        </Panel>

        <PrimaryButton onClick={() => navigate(backTo)}>
          {partyState ? c.backToParty : c.backToGame}
        </PrimaryButton>
      </div>
    </div>
  );
}
