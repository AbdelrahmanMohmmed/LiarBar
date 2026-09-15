import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import createContextHook from "../utils/createContextHook";
import { useGame } from "./gameContext";
import { VoiceLevelMonitor } from "./voiceLevels";

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

/**
 * What the UI needs to know about one peer link, in plain terms.
 *
 * RTCPeerConnection exposes half a dozen overlapping state machines
 * (connectionState, iceConnectionState, signalingState, iceGatheringState) and
 * none of them alone answers "can this person hear me". This collapses them
 * into the four states a player can act on.
 */
export type PeerHealth =
  /** Handshaking. Normal for a second or two after someone joins. */
  | "connecting"
  /** Audio path is up. */
  | "connected"
  /** Was up, dropped, we're retrying. Usually recovers by itself. */
  | "recovering"
  /** Gave up. Almost always means no TURN relay and a NAT that needs one. */
  | "failed";

/** How many ICE restarts to attempt before declaring a peer failed. */
const MAX_ICE_RESTARTS = 3;
/** Backoff between restarts. Immediate retries just burn the same failure. */
const ICE_RESTART_DELAYS_MS = [800, 2500, 6000];

function healthFrom(pc: RTCPeerConnection): PeerHealth {
  switch (pc.connectionState) {
    case "connected":
      return "connected";
    case "failed":
      return "failed";
    case "disconnected":
      return "recovering";
    default:
      return "connecting";
  }
}

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

/**
 * Is this connection relayed through TURN, or direct?
 *
 * Worth knowing for two reasons: a relayed call costs the TURN server real
 * bandwidth (so "everyone is relayed" is a bill, not just a curiosity), and
 * "nobody is ever relayed" usually means TURN isn't actually reachable and the
 * only players who can hear each other are the ones on the same network.
 * Neither fact is visible anywhere else.
 */
async function isRelayed(pc: RTCPeerConnection): Promise<boolean> {
  try {
    const stats = await pc.getStats();
    let selectedPairId: string | null = null;
    stats.forEach((report) => {
      if (report.type === "transport" && report.selectedCandidatePairId) {
        selectedPairId = report.selectedCandidatePairId as string;
      }
    });

    let relayed = false;
    stats.forEach((report) => {
      const isSelected =
        report.type === "candidate-pair" &&
        (report.id === selectedPairId ||
          (selectedPairId === null && report.nominated && report.state === "succeeded"));
      if (!isSelected) return;
      const local = stats.get(report.localCandidateId as string);
      if (local?.candidateType === "relay") relayed = true;
    });
    return relayed;
  } catch {
    return false;
  }
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
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(() => new Set());
  const [peerHealth, setPeerHealth] = useState<Record<string, PeerHealth>>({});
  /**
   * The browser refused to play incoming audio because there has been no user
   * gesture yet. Critically this is SILENT: the call is connected, everyone
   * else can hear you, and you hear nothing with no error anywhere. Surfacing
   * it is the difference between a one-tap fix and "voice doesn't work".
   */
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  /** True when at least one peer is relayed through TURN rather than direct. */
  const [usingRelay, setUsingRelay] = useState(false);

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
  /** ICE restart attempts per peer, reset on a successful connection. */
  const restartCountRef = useRef<Map<string, number>>(new Map());
  const restartTimersRef = useRef<Map<string, number>>(new Map());

  // One monitor for the whole room. See lib/voiceLevels.ts for why the level
  // map is read through a ref rather than pushed through state.
  const levelsRef = useRef<VoiceLevelMonitor | null>(null);
  if (levelsRef.current === null) {
    levelsRef.current = new VoiceLevelMonitor((speaking) => setSpeakingIds(speaking));
  }

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
    restartCountRef.current.delete(peerId);

    const timer = restartTimersRef.current.get(peerId);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      restartTimersRef.current.delete(peerId);
    }

    levelsRef.current?.remove(peerId);
    setPeerHealth((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  const stopVoice = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    for (const peerId of Array.from(peersRef.current.keys())) {
      closePeer(peerId);
    }
    levelsRef.current?.remove("me");
    setIsMuted(true);
    setPeerCount(0);
    setSpeakingIds(new Set());
    setPeerHealth({});
    setAudioBlocked(false);
    setUsingRelay(false);
  }, [closePeer]);

  const reportTransport = useCallback(async (pc: RTCPeerConnection) => {
    if (await isRelayed(pc)) setUsingRelay(true);
  }, []);

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

        // Meter this peer so the room can show who is talking.
        levelsRef.current?.add(peerId, stream);

        audioEl.play().then(
          () => setAudioBlocked(false),
          () => {
            // Autoplay is blocked until a user gesture. This fails SILENTLY:
            // the call is up, everyone else hears you fine, and you hear
            // nothing with no error surfaced anywhere. Flag it so the UI can
            // offer the one tap that fixes it.
            setAudioBlocked(true);
          },
        );
      };

      /**
       * Recover a dropped link instead of losing the peer.
       *
       * The old handler called restartIce() once, on the first `failed`, and
       * then never again — so a peer that dropped twice (a phone switching
       * from wifi to mobile data, which is the single most common cause) was
       * silently gone for the rest of the night with no indication why.
       *
       * Restarts are now retried with backoff. Immediate retries are pointless:
       * they re-run the same gathering against the same broken path.
       */
      const scheduleIceRestart = () => {
        if (restartTimersRef.current.has(peerId)) return;

        const attempt = restartCountRef.current.get(peerId) ?? 0;
        if (attempt >= MAX_ICE_RESTARTS) {
          setPeerHealth((prev) => ({ ...prev, [peerId]: "failed" }));
          // Reaching here nearly always means no TURN relay is configured and
          // this pair needs one. Say so once, loudly, in the console — it's
          // the only actionable diagnosis and it is otherwise invisible.
          console.warn(
            `[voice] gave up on peer ${peerId} after ${MAX_ICE_RESTARTS} ICE restarts. ` +
              "If this happens across networks, TURN is missing or misconfigured " +
              "(VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL).",
          );
          return;
        }

        restartCountRef.current.set(peerId, attempt + 1);
        setPeerHealth((prev) => ({ ...prev, [peerId]: "recovering" }));

        const delay = ICE_RESTART_DELAYS_MS[attempt] ?? 6000;
        const timer = window.setTimeout(() => {
          restartTimersRef.current.delete(peerId);
          if (pc.connectionState === "closed") return;
          try {
            pc.restartIce();
          } catch {
            /* Not supported on very old Safari; the mesh effect will rebuild. */
          }
        }, delay);
        restartTimersRef.current.set(peerId, timer);
      };

      pc.onconnectionstatechange = () => {
        const health = healthFrom(pc);
        setPeerHealth((prev) =>
          prev[peerId] === health ? prev : { ...prev, [peerId]: health },
        );

        if (pc.connectionState === "connected") {
          // A clean connection resets the budget, so a link that flaps all
          // evening keeps recovering rather than exhausting its retries once.
          restartCountRef.current.set(peerId, 0);
          void reportTransport(pc);
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          scheduleIceRestart();
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") scheduleIceRestart();
      };

      setPeerHealth((prev) => ({ ...prev, [peerId]: "connecting" }));
      return pc;
    },
    [reportTransport],
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
    setMicError(null);
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

      // Meter our own mic under the reserved id "me". Seeing your own bar move
      // is how you find out your mic works BEFORE talking into it for ten
      // seconds and asking whether anyone can hear you.
      levelsRef.current?.add("me", stream);
      levelsRef.current?.resume();

      // Opening the mic is itself a user gesture, so it's the right moment to
      // retry any audio the browser refused to autoplay.
      audioElementsRef.current.forEach((audio) => {
        if (audio.paused) void audio.play().then(() => setAudioBlocked(false), () => {});
      });

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
      // getUserMedia's failure modes need different fixes, and "check
      // permissions" is wrong advice for three of the four. Name them.
      const name = (err as DOMException | undefined)?.name ?? "";
      const message =
        name === "NotAllowedError"
          ? "Microphone blocked. Allow it in your browser's site settings."
          : name === "NotFoundError"
            ? "No microphone found on this device."
            : name === "NotReadableError"
              ? "Your microphone is in use by another app."
              : window.isSecureContext === false
                ? "Voice needs a secure (https) connection."
                : "Couldn't turn on the microphone.";

      console.error("[voice] getUserMedia failed:", name, err);
      setMicError(message);
      addToast(message, "error");
    } finally {
      setIsConnecting(false);
    }
  }, [addToast]);

  const muteMic = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = false;
      setIsMuted(true);
      // A disabled track still emits silence, so the meter would sit at zero
      // and read as "connected but not speaking" rather than "muted". Drop it.
      levelsRef.current?.remove("me");
      setSpeakingIds((prev) => {
        if (!prev.has("me")) return prev;
        const next = new Set(prev);
        next.delete("me");
        return next;
      });
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
      levelsRef.current?.resume();
      let anyPlaying = false;
      audioElementsRef.current.forEach((audio) => {
        if (audio.paused) {
          void audio.play().then(
            () => {
              anyPlaying = true;
              setAudioBlocked(false);
            },
            () => {},
          );
        } else {
          anyPlaying = true;
        }
      });
      if (anyPlaying) setAudioBlocked(false);
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

  // Tear the audio graph down for good when the provider goes away. Leaving an
  // AudioContext open keeps the device's audio hardware awake, which on a
  // phone is a measurable battery drain for a page nobody is listening to.
  useEffect(() => {
    const monitor = levelsRef.current;
    return () => monitor?.destroy();
  }, []);

  /**
   * One-tap recovery for blocked audio.
   *
   * Exposed as an action rather than handled only by the passive gesture
   * listener, because the passive listener can only fire on a gesture the
   * player happens to make. Someone who joins, hears nothing, and sits still
   * waiting never produces one.
   */
  const enableAudio = useCallback(() => {
    levelsRef.current?.resume();
    audioElementsRef.current.forEach((audio) => {
      void audio.play().then(() => setAudioBlocked(false), () => {});
    });
  }, []);

  /** Read a live 0..1 level without causing a re-render. See voiceLevels.ts. */
  const getLevel = useCallback(
    (id: string) => levelsRef.current?.levels.get(id) ?? 0,
    [],
  );

  const anyoneFailed = useMemo(
    () => Object.values(peerHealth).some((h) => h === "failed"),
    [peerHealth],
  );

  return {
    isMuted,
    isConnecting,
    peerCount,
    toggleMute,
    unmuteMic,
    muteMic,

    /** Player ids currently speaking. "me" is this player's own mic. */
    speakingIds,
    /** Live level 0..1 for a player id, read without re-rendering. */
    getLevel,
    /** Per-peer link health, for showing who can't hear you and why. */
    peerHealth,
    /** At least one peer exhausted its ICE restarts — almost always missing TURN. */
    anyoneFailed,
    /** The browser is refusing to play incoming audio until a gesture. */
    audioBlocked,
    enableAudio,
    /** A specific, actionable reason the mic didn't open, or null. */
    micError,
    /** At least one peer is relayed through TURN rather than direct. */
    usingRelay,
  };
}, "useVoice");
