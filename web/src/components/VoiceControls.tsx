import { useState, useCallback, useEffect, useRef, memo } from "react";
import { useGame } from "@/lib/gameContext";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceControlsProps {
  roomId: string;
}

export const VoiceControls = memo(function VoiceControls({
  roomId,
}: VoiceControlsProps) {
  const { gameState, myPlayerId, sendWebRTCSignal, addToast } = useGame();
  const [isMuted, setIsMuted] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const startVoice = useCallback(async () => {
    setIsConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const track = stream.getAudioTracks()[0];
      if (track) track.enabled = false;
      setIsMuted(true);
      setIsVoiceActive(true);
      addToast("Microphone connected", "success");
      connectToPeers(stream);
    } catch (err) {
      console.error("Failed to get microphone:", err);
      addToast("Could not access microphone. Check browser permissions.", "error");
    } finally {
      setIsConnecting(false);
    }
  }, [addToast]);

  const stopVoice = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    audioElementsRef.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
    });
    audioElementsRef.current.clear();
    pendingCandidatesRef.current.clear();
    setIsMuted(true);
    setIsVoiceActive(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const track = streamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string, localStream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWebRTCSignal(peerId, {
            type: "ice-candidate",
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        let audioEl = audioElementsRef.current.get(peerId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          audioElementsRef.current.set(peerId, audioEl);
        }
        audioEl.srcObject = event.streams[0];
        audioEl.play().catch(() => {
          // Autoplay blocked - user needs to interact first
        });
      };

      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === "disconnected" ||
          pc.iceConnectionState === "failed"
        ) {
          peersRef.current.delete(peerId);
        }
      };

      return pc;
    },
    [sendWebRTCSignal],
  );

  const connectToPeers = useCallback(
    (localStream: MediaStream) => {
      if (!gameState || !myPlayerId) return;

      const otherPlayers = gameState.players.filter(
        (p) => p.id !== myPlayerId && !p.isBot,
      );

      for (const player of otherPlayers) {
        if (peersRef.current.has(player.id)) continue;

        const pc = createPeerConnection(player.id, localStream);
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            sendWebRTCSignal(player.id, {
              type: "offer",
              sdp: pc.localDescription,
            });
          })
          .catch(console.error);

        peersRef.current.set(player.id, pc);
      }
    },
    [gameState, myPlayerId, createPeerConnection, sendWebRTCSignal],
  );

  useEffect(() => {
    const handleSignal = async (event: Event) => {
      const { fromId, signal } = (event as CustomEvent).detail;
      if (!signal) return;

      const localStream = streamRef.current;
      if (!localStream) return;

      let pc = peersRef.current.get(fromId);

      try {
        if (signal.type === "offer") {
          if (!pc) {
            pc = createPeerConnection(fromId, localStream);
            peersRef.current.set(fromId, pc);
          }
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendWebRTCSignal(fromId, { type: "answer", sdp: pc.localDescription });

          // Process any pending candidates
          const pending = pendingCandidatesRef.current.get(fromId) || [];
          for (const candidate of pending) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch {}
          }
          pendingCandidatesRef.current.delete(fromId);
        } else if (signal.type === "answer") {
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.type === "ice-candidate") {
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            // Queue until remote description is set
            const pending = pendingCandidatesRef.current.get(fromId) || [];
            pending.push(signal.candidate);
            pendingCandidatesRef.current.set(fromId, pending);
          }
        }
      } catch (err) {
        console.error("WebRTC signal error:", err);
      }
    };

    window.addEventListener("webrtc_signal", handleSignal);
    return () => window.removeEventListener("webrtc_signal", handleSignal);
  }, [sendWebRTCSignal, createPeerConnection]);

  useEffect(() => {
    return () => {
      stopVoice();
    };
  }, [stopVoice]);

  const voiceActivePlayers = gameState?.players.filter(
    (p) => p.id !== myPlayerId && !p.isBot && p.isConnected
  ).length ?? 0;

  return (
    <div className="flex items-center gap-2">
      {isVoiceActive && (
        <span className="text-[10px] text-emerald-400/60">
          {voiceActivePlayers > 0 ? `${voiceActivePlayers} online` : "no peers"}
        </span>
      )}
      <button
        onClick={isVoiceActive ? toggleMute : startVoice}
        disabled={isConnecting}
        className={cn(
          "relative rounded-full w-9 h-9 transition-all flex items-center justify-center",
          isVoiceActive && !isMuted
            ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 ring-2 ring-emerald-500/30"
            : isVoiceActive
              ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
              : "bg-[#2a1515] text-amber-200/50 hover:bg-[#3a1f1f]",
        )}
        title={
          isVoiceActive
            ? isMuted
              ? "Unmute microphone"
              : "Mute microphone"
            : "Connect voice chat"
        }
      >
        {isConnecting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isVoiceActive && !isMuted ? (
          <Mic className="w-4 h-4" />
        ) : (
          <MicOff className="w-4 h-4" />
        )}
      </button>
    </div>
  );
});
