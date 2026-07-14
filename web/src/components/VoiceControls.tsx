import { useState, useCallback, useEffect, useRef, memo } from "react";
import { useGame } from "@/lib/gameContext";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceControlsProps {
  roomId: string;
}

/**
 * Build the ICE server list. STUN is enough on the same LAN, but cross-network
 * calls (mobile data, symmetric NAT) require a TURN relay. Provide TURN via env:
 *   VITE_TURN_URL=turn:turn.example.com:3478
 *   VITE_TURN_USERNAME=...
 *   VITE_TURN_CREDENTIAL=...
 */
function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  const turnUrl = (import.meta.env.VITE_TURN_URL as string | undefined)?.trim();
  const turnUser = (import.meta.env.VITE_TURN_USERNAME as string | undefined)?.trim();
  const turnCred = (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined)?.trim();

  // A turn:/turns: server with no credentials makes RTCPeerConnection throw,
  // which would break ALL voice — so only add TURN when fully configured.
  if (turnUrl && turnCred) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
  } else if (turnUrl) {
    console.warn(
      "[voice] VITE_TURN_URL is set but username/credential is missing — " +
        "ignoring TURN and using STUN only. Cross-network calls will fail.",
    );
  }

  if (!voiceIceLogged) {
    voiceIceLogged = true;
    console.info(
      "[voice] ICE servers:",
      servers.map((s) => s.urls),
      turnUrl && turnCred ? "(TURN active)" : "(STUN only — no TURN)",
    );
  }
  return servers;
}

let voiceIceLogged = false;

export const VoiceControls = memo(function VoiceControls({
  roomId,
}: VoiceControlsProps) {
  const { lobbyState, gameState, codenamesState, higherLowerState, rentoState, myPlayerId, sendWebRTCSignal, addToast } = useGame();

  const activePlayers = lobbyState
    ? lobbyState.players
    : (rentoState || gameState || codenamesState || higherLowerState)?.players ?? [];
  const [isMuted, setIsMuted] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // Perfect-negotiation bookkeeping, per peer.
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());

  // Keep the latest signaling helper in a ref so peer-connection callbacks
  // (created once, long-lived) always call the current version.
  const sendSignalRef = useRef(sendWebRTCSignal);
  sendSignalRef.current = sendWebRTCSignal;
  const myIdRef = useRef(myPlayerId);
  myIdRef.current = myPlayerId;

  const stopVoice = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    peersRef.current.forEach((pc) => {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onnegotiationneeded = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
    });
    peersRef.current.clear();
    audioElementsRef.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
    });
    audioElementsRef.current.clear();
    pendingCandidatesRef.current.clear();
    makingOfferRef.current.clear();
    ignoreOfferRef.current.clear();
    setIsMuted(true);
  }, []);

  const getPeerAudioTransceiver = (pc: RTCPeerConnection) =>
    pc.getTransceivers().find(
      (t) =>
        t.sender.track?.kind === "audio" ||
        t.receiver.track?.kind === "audio" ||
        t.mid === "0",
    );

  const createPeerConnection = useCallback(
    (peerId: string, initiator: boolean): RTCPeerConnection => {
      let pc: RTCPeerConnection;
      try {
        pc = new RTCPeerConnection({ iceServers: getIceServers() });
      } catch (err) {
        // Bad TURN config should never kill voice — fall back to plain STUN.
        console.error("[voice] RTCPeerConnection init failed, retrying STUN-only:", err);
        pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
      }

      // The initiator seeds a single audio m-line in recvonly so that both
      // sides are connected and can *receive* before anyone opens their mic.
      // The responder gets its transceiver from the remote offer, so only the
      // initiator adds one here (avoids duplicate m-lines).
      if (initiator) {
        pc.addTransceiver("audio", { direction: "recvonly" });
        // If the mic is already live (unmuted before this peer joined),
        // upgrade to sendrecv straight away.
        if (streamRef.current) {
          const track = streamRef.current.getAudioTracks()[0];
          const transceiver = getPeerAudioTransceiver(pc);
          if (track && transceiver) {
            transceiver.sender.replaceTrack(track);
            transceiver.direction = "sendrecv";
          }
        }
      }

      // Perfect negotiation: either side can (re)negotiate. Changing a
      // transceiver's direction (recvonly -> sendrecv on unmute) fires this.
      pc.onnegotiationneeded = async () => {
        try {
          makingOfferRef.current.set(peerId, true);
          await pc.setLocalDescription();
          sendSignalRef.current(peerId, {
            type: "description",
            sdp: pc.localDescription,
          });
        } catch (err) {
          console.error("[voice] negotiation error:", peerId, err);
        } finally {
          makingOfferRef.current.set(peerId, false);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignalRef.current(peerId, {
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
        // We attach the mic via replaceTrack (no associated MediaStream), so
        // event.streams is often empty — build a stream from the track itself.
        const stream =
          event.streams[0] ?? new MediaStream([event.track]);
        audioEl.srcObject = stream;
        audioEl.play().catch(() => {
          // Autoplay blocked until a user gesture; unlockAudio() retries.
        });
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          // Recoverable: force an ICE restart rather than dropping the peer.
          try {
            pc.restartIce();
          } catch {
            /* not supported everywhere; the reconnect effect will retry */
          }
        }
      };

      return pc;
    },
    [],
  );

  // Ensure a peer connection exists. `initiator` is decided by ID ordering so
  // exactly one side seeds the connection (the other builds it from the offer).
  const ensurePeer = useCallback(
    (peerId: string, initiator: boolean): RTCPeerConnection => {
      let pc = peersRef.current.get(peerId);
      if (!pc) {
        pc = createPeerConnection(peerId, initiator);
        peersRef.current.set(peerId, pc);
      }
      return pc;
    },
    [createPeerConnection],
  );

  const unmuteMic = useCallback(async () => {
    // Already have a stream: just re-enable the track.
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
      if (track) track.enabled = true;
      setIsMuted(false);
      addToast("Microphone connected", "success");

      // Attach the mic to every existing peer. Flipping the transceiver to
      // sendrecv fires onnegotiationneeded on THIS side regardless of which
      // player has the smaller ID — perfect negotiation handles the rest.
      for (const pc of peersRef.current.values()) {
        const transceiver = getPeerAudioTransceiver(pc);
        if (transceiver) {
          await transceiver.sender.replaceTrack(track);
          transceiver.direction = "sendrecv";
        } else {
          pc.addTrack(track, stream);
        }
      }
    } catch (err) {
      console.error("[voice] failed to get microphone:", err);
      addToast("Could not access microphone. Check permissions.", "error");
    } finally {
      setIsConnecting(false);
    }
  }, [addToast]);

  const muteMic = useCallback(() => {
    if (streamRef.current) {
      const track = streamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = false;
        setIsMuted(true);
      }
    }
  }, []);

  // Connect to every other human player. Only the smaller ID initiates; the
  // larger ID waits for the incoming offer. This yields exactly one audio
  // m-line per pair and lets muted users listen immediately.
  useEffect(() => {
    if (!myPlayerId) return;

    const others = activePlayers.filter(
      (p) => p.id !== myPlayerId && !p.isBot && p.isConnected,
    );

    for (const player of others) {
      if (myPlayerId < player.id) {
        ensurePeer(player.id, true);
      }
    }

    // Tear down peers for players who left.
    const presentIds = new Set(others.map((p) => p.id));
    for (const peerId of Array.from(peersRef.current.keys())) {
      if (!presentIds.has(peerId)) {
        peersRef.current.get(peerId)?.close();
        peersRef.current.delete(peerId);
        const audio = audioElementsRef.current.get(peerId);
        if (audio) {
          audio.pause();
          audio.srcObject = null;
          audioElementsRef.current.delete(peerId);
        }
        pendingCandidatesRef.current.delete(peerId);
        makingOfferRef.current.delete(peerId);
        ignoreOfferRef.current.delete(peerId);
      }
    }
  }, [activePlayers, myPlayerId, ensurePeer]);

  // Handle inbound signaling with the perfect-negotiation algorithm.
  useEffect(() => {
    const handleSignal = async (event: Event) => {
      const { fromId, signal } = (event as CustomEvent).detail;
      const selfId = myIdRef.current;
      if (!signal || !selfId) return;

      // Politeness: the larger ID yields on collisions. The smaller ID is the
      // initiator and never yields.
      const polite = selfId > fromId;

      try {
        if (signal.type === "description") {
          // Build the peer lazily if the offer arrives first (responder side).
          const pc = ensurePeer(fromId, false);
          const description = signal.sdp as RTCSessionDescriptionInit;

          const offerCollision =
            description.type === "offer" &&
            (makingOfferRef.current.get(fromId) || pc.signalingState !== "stable");

          const ignoreOffer = !polite && offerCollision;
          ignoreOfferRef.current.set(fromId, ignoreOffer);
          if (ignoreOffer) return;

          await pc.setRemoteDescription(description);

          // Flush any ICE candidates that arrived before the remote description.
          const pending = pendingCandidatesRef.current.get(fromId);
          if (pending) {
            for (const c of pending) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(c));
              } catch (err) {
                console.error("[voice] queued candidate error:", err);
              }
            }
            pendingCandidatesRef.current.delete(fromId);
          }

          if (description.type === "offer") {
            await pc.setLocalDescription();
            sendSignalRef.current(fromId, {
              type: "description",
              sdp: pc.localDescription,
            });
          }
        } else if (signal.type === "ice-candidate") {
          const pc = peersRef.current.get(fromId);
          if (pc && pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (err) {
              if (!ignoreOfferRef.current.get(fromId)) {
                console.error("[voice] addIceCandidate error:", err);
              }
            }
          } else {
            // Remote description not set yet — queue until it is.
            const pending = pendingCandidatesRef.current.get(fromId) || [];
            pending.push(signal.candidate);
            pendingCandidatesRef.current.set(fromId, pending);
          }
        }
      } catch (err) {
        console.error("[voice] signal handling error:", err);
      }
    };

    window.addEventListener("webrtc_signal", handleSignal);
    return () => window.removeEventListener("webrtc_signal", handleSignal);
  }, [ensurePeer]);

  // Browsers block autoplay of remote audio until the user interacts with the
  // page. Retry playback on the first gesture so listen-only works without
  // ever opening the mic.
  useEffect(() => {
    const unlock = () => {
      audioElementsRef.current.forEach((audio) => {
        if (audio.paused) audio.play().catch(() => {});
      });
    };
    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  useEffect(() => {
    return () => {
      stopVoice();
    };
  }, [stopVoice]);

  const voiceActivePlayers = activePlayers.filter(
    (p) => p.id !== myPlayerId && !p.isBot && p.isConnected,
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
