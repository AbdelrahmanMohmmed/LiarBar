import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import createContextHook from "../utils/createContextHook";
import { useGame } from "./gameContext";

/**
 * Room-wide voice chat (full-mesh WebRTC).
 *
 * This lives in a provider mounted **above** the router so that navigating —
 * lobby menu -> in-game view -> another game -> /play — never tears the mesh
 * down. Voice stops on one condition only: leaving the room (`myRoomId` goes
 * null). `VoiceControls` is a pure consumer of this state.
 *
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

/**
 * Remote <audio> elements must be in the document for iOS Safari to play them
 * reliably; a detached `new Audio()` is flaky there. One hidden sink holds all
 * of them.
 */
const AUDIO_SINK_ID = "voice-audio-sink";

/**
 * The only player fields voice needs. Games model players differently
 * (`PlayerData`, `RentoPlayerState`, ...), so match structurally.
 */
type VoicePeer = { id: string; isBot: boolean; isConnected: boolean };

function getAudioSink(): HTMLElement {
  let sink = document.getElementById(AUDIO_SINK_ID);
  if (!sink) {
    sink = document.createElement("div");
    sink.id = AUDIO_SINK_ID;
    sink.style.display = "none";
    document.body.appendChild(sink);
  }
  return sink;
}

export const [VoiceProvider, useVoice] = createContextHook(() => {
  const {
    partyState,
    lobbyState,
    gameState,
    codenamesState,
    higherLowerState,
    dominoState,
    rentoState,
    myPlayerId,
    myRoomId,
    sendWebRTCSignal,
    addToast,
  } = useGame();

  const [isMuted, setIsMuted] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [peerCount, setPeerCount] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // The audio transceiver per peer, captured at creation. Looking it up by
  // scanning `getTransceivers()` needs an mid/kind guess that isn't reliable.
  const transceiversRef = useRef<Map<string, RTCRtpTransceiver>>(new Map());
  // Perfect-negotiation bookkeeping, per peer.
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());

  // Keep the latest signaling helper in a ref so peer-connection callbacks
  // (created once, long-lived) always call the current version.
  const sendSignalRef = useRef(sendWebRTCSignal);
  sendSignalRef.current = sendWebRTCSignal;
  const myIdRef = useRef(myPlayerId);
  myIdRef.current = myPlayerId;

  const closePeer = useCallback((peerId: string) => {
    const pc = peersRef.current.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onnegotiationneeded = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
      peersRef.current.delete(peerId);
    }
    const audio = audioElementsRef.current.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      audioElementsRef.current.delete(peerId);
    }
    pendingCandidatesRef.current.delete(peerId);
    transceiversRef.current.delete(peerId);
    makingOfferRef.current.delete(peerId);
    ignoreOfferRef.current.delete(peerId);
  }, []);

  const stopVoice = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    for (const peerId of Array.from(peersRef.current.keys())) {
      closePeer(peerId);
    }
    setIsMuted(true);
    setPeerCount(0);
  }, [closePeer]);

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
        const transceiver = pc.addTransceiver("audio", { direction: "recvonly" });
        transceiversRef.current.set(peerId, transceiver);
        // If the mic is already live (unmuted before this peer joined),
        // upgrade to sendrecv straight away.
        const track = streamRef.current?.getAudioTracks()[0];
        if (track) {
          transceiver.sender.replaceTrack(track);
          transceiver.direction = "sendrecv";
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
        // The responder's transceiver comes from the remote offer, so this is
        // the first point at which it can be recorded.
        if (!transceiversRef.current.has(peerId) && event.transceiver) {
          transceiversRef.current.set(peerId, event.transceiver);
        }

        let audioEl = audioElementsRef.current.get(peerId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          // Typed only on HTMLVideoElement, but iOS Safari honours it on audio.
          audioEl.setAttribute("playsinline", "");
          getAudioSink().appendChild(audioEl);
          audioElementsRef.current.set(peerId, audioEl);
        }
        // We attach the mic via replaceTrack (no associated MediaStream), so
        // event.streams is often empty — build a stream from the track itself.
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        audioEl.srcObject = stream;
        audioEl.play().catch(() => {
          // Autoplay blocked until a user gesture; the unlock effect retries.
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
          channelCount: 1,
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
      for (const [peerId, pc] of peersRef.current.entries()) {
        const transceiver = transceiversRef.current.get(peerId);
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
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = false;
      setIsMuted(true);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) void unmuteMic();
    else muteMic();
  }, [isMuted, unmuteMic, muteMic]);

  // The set of human peers to hold connections with, as a stable string so the
  // mesh effect re-runs when players join/leave rather than on every game tick.
  //
  // The party roster comes FIRST and deliberately so. During a game switch the
  // sub-game state is briefly null while the old engine is destroyed and the
  // new one is built; deriving peers from sub-game state alone would see an
  // empty roster for that instant, tear down every peer connection, and then
  // rebuild them — an audible dropout on every single game change, which is
  // exactly the moment the group is talking most. The party roster never goes
  // empty, so the mesh never notices the switch happened.
  const activePlayers: VoicePeer[] =
    partyState?.players ??
    lobbyState?.players ??
    (
      gameState ||
      codenamesState ||
      higherLowerState ||
      dominoState ||
      rentoState
    )?.players ??
    [];

  const peerKey = useMemo(
    () =>
      activePlayers
        .filter((p) => p.id !== myPlayerId && !p.isBot && p.isConnected)
        .map((p) => p.id)
        .sort()
        .join(","),
    [activePlayers, myPlayerId],
  );

  // Connect to every other human player. Only the smaller ID initiates; the
  // larger ID waits for the incoming offer. This yields exactly one audio
  // m-line per pair and lets muted users listen immediately.
  useEffect(() => {
    if (!myPlayerId) return;

    const peerIds = peerKey ? peerKey.split(",") : [];
    for (const peerId of peerIds) {
      if (myPlayerId < peerId) ensurePeer(peerId, true);
    }

    // Tear down peers for players who left.
    const present = new Set(peerIds);
    for (const peerId of Array.from(peersRef.current.keys())) {
      if (!present.has(peerId)) closePeer(peerId);
    }

    setPeerCount(peerIds.length);
  }, [peerKey, myPlayerId, ensurePeer, closePeer]);

  // Leaving the room is the only thing that stops voice. Navigating between
  // the lobby and a game keeps the mesh and the mic alive.
  useEffect(() => {
    if (!myRoomId) stopVoice();
  }, [myRoomId, stopVoice]);

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

  // Only fires when the whole app unmounts — route changes no longer reach it.
  useEffect(() => stopVoice, [stopVoice]);

  return {
    isMuted,
    isConnecting,
    peerCount,
    toggleMute,
    unmuteMic,
    muteMic,
  };
}, "useVoice");
