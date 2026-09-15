import { useState } from "react";
import { Copy, Check, Share2, X, MessageCircle } from "lucide-react";
import { useLanguage } from "@/lib/languageContext";
import { inviteText, inviteUrl } from "@/lib/brand";

/**
 * The invite sheet.
 *
 * This is the highest-leverage surface in the product: it is how literally
 * every player who isn't the host arrives. Three deliberate decisions:
 *
 * 1. **The room code is displayed larger than the link.** People read the code
 *    out loud over voice far more often than they paste the link, so it has to
 *    survive being said across a room with music on.
 * 2. **WhatsApp gets its own button.** In this product's market it is not "a"
 *    share target, it is *the* share target. Routing through the generic OS
 *    share sheet costs two extra taps for the overwhelmingly common case.
 * 3. **Copy falls back all the way down.** navigator.clipboard is unavailable
 *    on insecure origins and in some in-app browsers (which is exactly where
 *    a WhatsApp link opens), so there's a textarea+execCommand fallback and,
 *    failing that, the text is selected so the user can copy it by hand. A
 *    silently-failing copy button on the invite screen would be fatal.
 */

interface Props {
  roomCode: string;
  gameName?: string;
  open: boolean;
  onClose: () => void;
}

function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => legacyCopy(text),
    );
  }
  return Promise.resolve(legacyCopy(text));
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function InviteSheet({ roomCode, gameName, open, onClose }: Props) {
  const { lang, t } = useLanguage();
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  if (!open) return null;

  const link = inviteUrl(roomCode);
  const message = inviteText(roomCode, lang, gameName);

  const flash = (what: "link" | "code") => {
    setCopied(what);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: message, url: link });
        return;
      } catch {
        /* User dismissed the sheet, or the browser refused. Fall through. */
      }
    }
    if (await copyToClipboard(message)) flash("link");
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="surface-lit w-full sm:max-w-md rounded-t-xl sm:rounded-xl p-5"
        style={{ paddingBottom: "calc(1.25rem + var(--safe-b))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-xl text-cream">{t("party.invite_title")}</h2>
            <p className="text-sm text-sand">{t("party.invite_sub")}</p>
          </div>
          <button onClick={onClose} className="btn btn-quiet btn-sm" aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>

        {/* The code, big. This is the thing that gets said out loud. */}
        <button
          onClick={async () => {
            if (await copyToClipboard(roomCode)) flash("code");
          }}
          className="w-full surface rounded-lg py-5 px-4 mb-3 text-center transition hover:bg-surface-raised active:scale-[0.99]"
        >
          <div className="text-[11px] uppercase tracking-widest text-sand mb-1">
            {t("party.room_code")}
          </div>
          <div className="font-numeric text-4xl text-gold select-all">{roomCode}</div>
          <div className="mt-2 text-xs text-sand inline-flex items-center gap-1.5">
            {copied === "code" ? (
              <>
                <Check size={13} className="text-mint" />
                {t("party.copied")}
              </>
            ) : (
              <>
                <Copy size={13} />
                {t("party.tap_to_copy")}
              </>
            )}
          </div>
        </button>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <a
            className="btn btn-live"
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={17} />
            WhatsApp
          </a>
          <button className="btn btn-ghost" onClick={shareNative}>
            <Share2 size={17} />
            {t("party.share")}
          </button>
        </div>

        <button
          onClick={async () => {
            if (await copyToClipboard(link)) flash("link");
          }}
          className="w-full field flex items-center justify-between gap-2 text-start"
        >
          <span className="truncate text-sm text-sand">{link}</span>
          {copied === "link" ? (
            <Check size={16} className="text-mint shrink-0" />
          ) : (
            <Copy size={16} className="text-sand shrink-0" />
          )}
        </button>

        <p className="mt-4 text-center text-xs text-sand">{t("party.invite_hint")}</p>
      </div>
    </div>
  );
}
