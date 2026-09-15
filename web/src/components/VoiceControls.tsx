import { memo } from "react";
import { useVoice } from "@/lib/voiceContext";
import { useLanguage } from "@/lib/languageContext";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mic button for room voice chat. All WebRTC state lives in `VoiceProvider`
 * (mounted above the router), so mounting/unmounting this anywhere — or in
 * several places across different screens — never disturbs an active call.
 *
 * Two things were wrong with it, and both only show up on a phone in Arabic:
 * the peer count and the button's tooltip were hard-coded English, and the
 * colours were raw Tailwind emerald and red rather than tokens. The count sat
 * in the header of four different game pages, so "3 online" was the one piece
 * of English left on an otherwise fully Arabic screen — and in an RTL line it
 * reorders to read "online 3".
 *
 * Connected peers are the one thing `live` (mint) exists for, per
 * DESIGN_SYSTEM.md §2: it means "right now", and a live voice channel is the
 * most literal case of that in the product.
 */
export const VoiceControls = memo(function VoiceControls() {
  const { isMuted, isConnecting, peerCount, toggleMute } = useVoice();
  const { t } = useLanguage();

  const label = isMuted ? t("voice.unmute") : t("voice.mute");

  return (
    <div className="flex items-center gap-2">
      <span className={cn("text-[10px]", peerCount > 0 ? "text-live/70" : "text-sand/60")}>
        {peerCount > 0
          ? t("voice.n_online").replace("{n}", String(peerCount))
          : t("voice.nobody")}
      </span>
      <button
        onClick={toggleMute}
        disabled={isConnecting}
        className={cn(
          "relative rounded-full w-9 h-9 transition-all flex items-center justify-center",
          !isMuted
            ? "bg-live/15 text-live hover:bg-live/25 ring-2 ring-live/30"
            : "bg-ruby/15 text-ruby hover:bg-ruby/25",
        )}
        title={label}
        aria-label={label}
      >
        {isConnecting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : !isMuted ? (
          <Mic className="w-4 h-4" />
        ) : (
          <MicOff className="w-4 h-4" />
        )}
      </button>
    </div>
  );
});
