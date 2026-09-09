import { memo } from "react";
import { useVoice } from "@/lib/voiceContext";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mic button for room voice chat. All WebRTC state lives in `VoiceProvider`
 * (mounted above the router), so mounting/unmounting this anywhere — or in
 * several places across different screens — never disturbs an active call.
 */
export const VoiceControls = memo(function VoiceControls() {
  const { isMuted, isConnecting, peerCount, toggleMute } = useVoice();

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-emerald-400/60">
        {peerCount > 0 ? `${peerCount} online` : "no peers"}
      </span>
      <button
        onClick={toggleMute}
        disabled={isConnecting}
        className={cn(
          "relative rounded-full w-9 h-9 transition-all flex items-center justify-center",
          !isMuted
            ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 ring-2 ring-emerald-500/30"
            : "bg-red-600/20 text-red-400 hover:bg-red-600/30",
        )}
        title={isMuted ? "Unmute microphone" : "Mute microphone"}
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
