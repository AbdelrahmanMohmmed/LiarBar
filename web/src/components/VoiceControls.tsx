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
  const { lobbyState, gameState, codenamesState, higherLowerState, myPlayerId, sendWebRTCSignal, addToast } = useGame();

  const activePlayers = lobbyState
    ? lobbyState.players
    : (gameState || codenamesState || higherLowerState)?.players ?? [];
  const [isMuted, setIsMuted] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());

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
    makingOfferRef.current.clear();
    setIsMuted(true);
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      // Add transceiver for audio in recvonly direction to listen without sharing mic yet
      pc.addTransceiver("audio", { direction: "recvonly" });

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

  const connectToPeer = useCallback(
    async (peerId: string) => {
      if (peersRef.current.has(peerId)) return;

      const pc = createPeerConnection(peerId);
      peersRef.current.set(peerId, pc);

      // Polite pattern: only the smaller player ID initiates the offer
      if (myPlayerId && myPlayerId < peerId) {
        try {
          makingOfferRef.current.set(peerId, true);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendWebRTCSignal(peerId, {
            type: "offer",
            sdp: pc.localDescription,
          });
        } catch (err) {
          console.error("Failed to create offer for peer:", peerId, err);
        } finally {
          makingOfferRef.current.set(peerId, false);
        }
      }
    },
    [createPeerConnection, myPlayerId, sendWebRTCSignal],
  );

  const unmuteMic = useCallback(async () => {
    if (streamRef.current) {
      const track = streamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = true;
        setIsMuted(false);
      }
      return;
    }

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
      if (track) {
        track.enabled = true;
      }
      setIsMuted(false);
      addToast("Microphone connected", "success");

      // Update all active connections to send audio
      for (const [peerId, pc] of peersRef.current) {
        const transceivers = pc.getTransceivers();
        const audioTransceiver = transceivers.find(
          (t) => t.receiver.track.kind === "audio"
        );

        if (audioTransceiver) {
          audioTransceiver.direction = "sendrecv";
        }

        if (track) {
          const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (sender) {
            await sender.replaceTrack(track);
          } else {
            pc.addTrack(track, stream);
          }
        }

        // Renegotiate if we are the polite peer initiator
        if (myPlayerId && myPlayerId < peerId) {
          try {
            makingOfferRef.current.set(peerId, true);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendWebRTCSignal(peerId, {
              type: "offer",
              sdp: pc.localDescription,
            });
          } catch (err) {
            console.error("Renegotiation offer error:", err);
          } finally {
            makingOfferRef.current.set(peerId, false);
          }
        }
      }
    } catch (err) {
      console.error("Failed to get microphone:", err);
      addToast("Could not access microphone. Check permissions.", "error");
    } finally {
      setIsConnecting(false);
    }
  }, [addToast, myPlayerId, sendWebRTCSignal]);

  const muteMic = useCallback(() => {
    if (streamRef.current) {
      const track = streamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = false;
        setIsMuted(true);
      }
    }
  }, []);

  // Monitor room players and connect automatically
  useEffect(() => {
    if (!myPlayerId) return;

    const otherPlayers = activePlayers.filter(
      (p) => p.id !== myPlayerId && !p.isBot && p.isConnected
    );

    for (const player of otherPlayers) {
      connectToPeer(player.id);
    }
  }, [activePlayers, myPlayerId, connectToPeer]);

  // Handle WebRTC signals from signaling server
  useEffect(() => {
    const handleSignal = async (event: Event) => {
      const { fromId, signal } = (event as CustomEvent).detail;
      if (!signal || !myPlayerId) return;

      let pc = peersRef.current.get(fromId);
      const polite = myPlayerId < fromId;

      try {
        if (signal.type === "offer") {
          const makingOffer = makingOfferRef.current.get(fromId) || false;
          const offerCollision = makingOffer || (pc && pc.signalingState !== "stable");

          if (offerCollision && !polite) {
            // Impolite peer ignores colliding offers
            return;
          }

          if (!pc) {
            pc = createPeerConnection(fromId);
            peersRef.current.set(fromId, pc);
          }

          if (offerCollision && polite) {
            // Polite peer rolls back its own offer in case of collision
            await pc.setLocalDescription({ type: "rollback" });
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // If we have a local stream, attach it
          if (streamRef.current) {
            const track = streamRef.current.getAudioTracks()[0];
            const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
            if (track) {
              if (sender) {
                await sender.replaceTrack(track);
              } else {
                pc.addTrack(track, streamRef.current);
              }
            }
            const transceivers = pc.getTransceivers();
            const audioTransceiver = transceivers.find(
              (t) => t.receiver.track.kind === "audio"
            );
            if (audioTransceiver) {
              audioTransceiver.direction = "sendrecv";
            }
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendWebRTCSignal(fromId, { type: "answer", sdp: pc.localDescription });

          // Process queued candidates
          const pending = pendingCandidatesRef.current.get(fromId) || [];
          for (const candidate of pending) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidatesRef.current.delete(fromId);

        } else if (signal.type === "answer") {
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.type === "ice-candidate") {
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            const pending = pendingCandidatesRef.current.get(fromId) || [];
            pending.push(signal.candidate);
            pendingCandidatesRef.current.set(fromId, pending);
          }
        }
      } catch (err) {
        console.error("WebRTC signal handling error:", err);
      }
    };

    window.addEventListener("webrtc_signal", handleSignal);
    return () => window.removeEventListener("webrtc_signal", handleSignal);
  }, [sendWebRTCSignal, createPeerConnection, myPlayerId]);

  useEffect(() => {
    return () => {
      stopVoice();
    };
  }, [stopVoice]);

  const voiceActivePlayers = activePlayers.filter(
    (p) => p.id !== myPlayerId && !p.isBot && p.isConnected
  ).length ?? 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-emerald-400/60">
        {voiceActivePlayers > 0 ? `${voiceActivePlayers} online` : "no peers"}
      </span>
      <button
        onClick={isMuted ? unmuteMic : muteMic}
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
