// WebRTC mesh (<=3 peers) for voice + camera, using the standard
// "perfect negotiation" pattern (polite/impolite by socketId order) so
// offers never collide regardless of who enables voice first.
import { useEffect, useRef, useState, useCallback } from 'react';

const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };

export function useVoice(socketRef, connected, myJoinedAt) {
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [mutedByAdmin, setMutedByAdmin] = useState(false);
  const [error, setError] = useState('');
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> MediaStream
  const [selfStream, setSelfStream] = useState(null);

  const peers = useRef({}); // socketId -> { pc, makingOffer, ignoreOffer, polite }
  const localStream = useRef(null);
  const ctx = useRef({ myId: null, participants: [] }); // fed by Room

  const getPeer = useCallback((sid) => {
    if (peers.current[sid]) return peers.current[sid];
    const myId = ctx.current.myId;
    const entry = {
      pc: new RTCPeerConnection(ICE),
      makingOffer: false,
      ignoreOffer: false,
      polite: myId ? myId < sid : true,
    };
    peers.current[sid] = entry;

    entry.pc.onnegotiationneeded = async () => {
      try {
        entry.makingOffer = true;
        await entry.pc.setLocalDescription();
        socketRef.current?.emit('webrtc:signal', { to: sid, data: { type: 'desc', sdp: entry.pc.localDescription } });
      } catch (e) {
        console.warn('[webrtc] negotiation failed:', e.message);
      } finally {
        entry.makingOffer = false;
      }
    };
    entry.pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current?.emit('webrtc:signal', { to: sid, data: { type: 'ice', candidate: e.candidate } });
    };
    entry.pc.ontrack = (e) => {
      setRemoteStreams((rs) => ({ ...rs, [sid]: e.streams[0] }));
    };
    entry.pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(entry.pc.connectionState)) {
        setRemoteStreams((rs) => {
          const next = { ...rs };
          delete next[sid];
          return next;
        });
      }
    };
    if (localStream.current) localStream.current.getTracks().forEach((t) => entry.pc.addTrack(t, localStream.current));
    return entry;
  }, [socketRef]);

  const closePeer = (sid) => {
    peers.current[sid]?.pc.close();
    delete peers.current[sid];
    setRemoteStreams((rs) => {
      const next = { ...rs };
      delete next[sid];
      return next;
    });
  };

  // ---- signaling ----
  useEffect(() => {
    if (!connected || !socketRef.current) return;
    const s = socketRef.current;

    const onPeerJoined = () => {
      // no immediate offer: renegotiation kicks in from either side when needed
    };

    const onSignal = async ({ from, data }) => {
      try {
        if (data.type === 'desc') {
          const entry = getPeer(from);
          const { pc } = entry;
          const offerCollision = data.sdp.type === 'offer' && (entry.makingOffer || pc.signalingState !== 'stable');
          entry.ignoreOffer = !entry.polite && offerCollision;
          if (entry.ignoreOffer) return;
          await pc.setRemoteDescription(data.sdp);
          if (data.sdp.type === 'offer') {
            await pc.setLocalDescription();
            s.emit('webrtc:signal', { to: from, data: { type: 'desc', sdp: pc.localDescription } });
          }
        } else if (data.type === 'ice' && data.candidate) {
          const entry = peers.current[from];
          if (!entry) return;
          try {
            await entry.pc.addIceCandidate(data.candidate);
          } catch (err) {
            if (!entry.ignoreOffer) throw err;
          }
        }
      } catch (e) {
        console.warn('[webrtc] signal error:', e.message);
      }
    };

    const onPeerLeft = ({ socketId }) => closePeer(socketId);
    const onForceMute = ({ muted }) => {
      setMutedByAdmin(muted);
      if (muted && localStream.current) {
        localStream.current.getAudioTracks().forEach((t) => (t.enabled = false));
        setMicOn(false);
      }
    };

    s.on('room:peer-joined', onPeerJoined);
    s.on('webrtc:signal', onSignal);
    s.on('room:peer-left', onPeerLeft);
    s.on('voice:forceMute', onForceMute);
    return () => {
      s.off('room:peer-joined', onPeerJoined);
      s.off('webrtc:signal', onSignal);
      s.off('room:peer-left', onPeerLeft);
      s.off('voice:forceMute', onForceMute);
    };
  }, [connected, socketRef, getPeer]);

  const joinVoice = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getVideoTracks().forEach((t) => (t.enabled = false)); // camera starts OFF
      localStream.current = stream;
      setSelfStream(stream);
      setJoined(true);
      setMicOn(true);
      setCamOn(false);
      // connect to everyone already in the room
      ctx.current.participants
        .filter((p) => p.socketId !== ctx.current.myId)
        .forEach((p) => getPeer(p.socketId));
    } catch (e) {
      setError(
        e.name === 'NotAllowedError'
          ? 'Microphone/camera permission denied. Allow access in your browser and try again.'
          : 'Could not access microphone: ' + e.message
      );
    }
  }, [getPeer]);

  const leaveVoice = useCallback(() => {
    Object.keys(peers.current).forEach(closePeer);
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    setSelfStream(null);
    setRemoteStreams({});
    setJoined(false);
  }, []);

  const toggleMic = useCallback(() => {
    if (mutedByAdmin) return;
    const next = !micOn;
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }, [micOn, mutedByAdmin]);

  const toggleCam = useCallback(() => {
    const next = !camOn;
    localStream.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
  }, [camOn]);

  const setContext = useCallback((myId, participants) => {
    ctx.current = { myId, participants };
  }, []);

  useEffect(() => () => leaveVoice(), [leaveVoice]);

  return { joined, joinVoice, leaveVoice, micOn, camOn, toggleMic, toggleCam, mutedByAdmin, error, selfStream, remoteStreams, setContext };
}
