import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Users, ArrowRight, Loader2 } from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { BRAND, getGame } from "@/lib/brand";
import { Seo } from "@/lib/seo";
import { Logo } from "@/components/brand/Logo";
import { LangToggle } from "@/components/LangToggle";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
const LS_NAME = `${BRAND.id}_playerName`;

interface RoomPreview {
  roomId: string;
  gameId: string;
  activeGameId?: string | null;
  phase: string;
  playerCount: number;
  maxPlayers: number;
  joinable?: boolean;
}

/**
 * The landing page for an invite link: /j/123456
 *
 * This is the first screen a new player ever sees, arriving from a WhatsApp
 * message, usually on a phone, usually mid-conversation, usually while
 * everyone else is already playing. Everything here is subordinate to getting
 * them into the room in one tap.
 *
 * - **The room is fetched before the form renders**, so the page can say
 *   "4 people playing Domino" instead of a bare code. A join screen that shows
 *   no evidence the room is real is the single biggest drop-off point — people
 *   assume the link is broken and go back to the chat.
 * - **The name is remembered.** A returning player gets a prefilled field and
 *   a single button. Retyping a name every night is a small tax paid by every
 *   player at every session.
 * - **A dead room says so immediately and offers the way forward** rather than
 *   failing on submit after the user has already typed.
 */
export default function JoinParty() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const { joinRoom, myPlayerId, myRoomId, reconnectRoom, addToast } = useGame();

  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [lookupState, setLookupState] = useState<"loading" | "ok" | "missing" | "error">(
    "loading",
  );
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    try {
      setName(localStorage.getItem(LS_NAME) ?? "");
    } catch {
      /* Private mode. Not worth handling further. */
    }
  }, []);

  // Already in this room on this device (a refresh, or a second tap on the
  // same link): skip the form entirely and reconnect.
  useEffect(() => {
    if (!roomId || !myPlayerId || myRoomId !== roomId) return;
    void reconnectRoom(roomId, myPlayerId)
      .then(() => navigate(`/r/${roomId}`, { replace: true }))
      .catch(() => {
        /* Stale ids; fall through to the normal join form. */
      });
  }, [roomId, myPlayerId, myRoomId, reconnectRoom, navigate]);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    fetch(`${BACKEND_URL}/api/room/${encodeURIComponent(roomId)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setLookupState("missing");
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        setPreview(await res.json());
        setLookupState("ok");
      })
      .catch(() => {
        if (!cancelled) setLookupState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      addToast(t("join.name_required"), "error");
      return;
    }
    if (!roomId) return;

    setJoining(true);
    try {
      await joinRoom(roomId, trimmed);
      try {
        localStorage.setItem(LS_NAME, trimmed);
      } catch {
        /* ignore */
      }
      navigate(`/r/${roomId}`, { replace: true });
    } catch (err) {
      addToast(err instanceof Error ? err.message : t("join.failed"), "error");
    } finally {
      setJoining(false);
    }
  };

  const gameMeta = preview?.activeGameId ? getGame(preview.activeGameId) : undefined;
  const full =
    preview !== null && preview.playerCount >= preview.maxPlayers;

  return (
    <div className="page grid place-items-center">
      <Seo
        title={t("join.title")}
        description={BRAND.description[lang]}
        path={`/j/${roomId ?? ""}`}
        noindex
        lang={lang}
      />

      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate("/")} aria-label={BRAND.name}>
            <Logo size={30} />
          </button>
          <LangToggle />
        </div>

        <div className="surface-lit rounded-xl p-6">
          {lookupState === "loading" && (
            <div className="space-y-3">
              <div className="skeleton h-6 w-2/3 rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-12 rounded-lg mt-6" />
            </div>
          )}

          {lookupState === "missing" && (
            <div className="text-center space-y-4">
              <p className="text-5xl" aria-hidden>
                🕳️
              </p>
              <h1 className="font-display text-xl text-cream">{t("join.gone_title")}</h1>
              <p className="text-sm text-sand">{t("join.gone_body")}</p>
              <button onClick={() => navigate("/")} className="btn btn-primary w-full">
                {t("join.start_own")}
              </button>
            </div>
          )}

          {lookupState === "error" && (
            <div className="text-center space-y-4">
              <h1 className="font-display text-xl text-cream">{t("join.offline_title")}</h1>
              <p className="text-sm text-sand">{t("join.offline_body")}</p>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-ghost w-full"
              >
                {t("join.retry")}
              </button>
            </div>
          )}

          {lookupState === "ok" && preview && (
            <>
              <div className="text-center mb-6">
                <div className="text-4xl mb-2" aria-hidden>
                  {gameMeta?.emoji ?? "🎉"}
                </div>
                <h1 className="font-display text-2xl text-cream">
                  {gameMeta
                    ? t("join.playing_now").replace("{game}", gameMeta.name[lang])
                    : t("join.party_waiting")}
                </h1>
                <p className="text-sm text-sand mt-1 inline-flex items-center gap-1.5">
                  <Users size={14} />
                  {t("join.n_here").replace("{n}", String(preview.playerCount))}
                  <span className="text-sand/60">·</span>
                  <span className="font-numeric text-gold">{preview.roomId}</span>
                </p>
              </div>

              {full ? (
                <div className="text-center space-y-3">
                  <p className="text-sm text-ruby font-bold">{t("join.full")}</p>
                  <button onClick={() => navigate("/")} className="btn btn-ghost w-full">
                    {t("join.start_own")}
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  <label className="block">
                    <span className="block text-xs text-sand mb-1.5">
                      {t("join.your_name")}
                    </span>
                    <input
                      className="field"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("join.name_placeholder")}
                      maxLength={24}
                      autoFocus
                      autoComplete="nickname"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={joining || !name.trim()}
                    className="btn btn-primary btn-lg w-full"
                  >
                    {joining ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        {t("join.join")}
                        <ArrowRight size={18} className="rtl:-scale-x-100" />
                      </>
                    )}
                  </button>

                  {preview.phase === "playing" && (
                    <p className="text-center text-xs text-sand">
                      {t("join.mid_game_hint")}
                    </p>
                  )}
                </form>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-sand mt-6">{BRAND.subTagline[lang]}</p>
      </div>
    </div>
  );
}
