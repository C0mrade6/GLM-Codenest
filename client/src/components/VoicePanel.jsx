// Voice/video: floating peer video grid + control buttons (WebRTC mesh).
export default function VoicePanel({ voice, participants, mode = 'full' }) {
  const { joined, joinVoice, leaveVoice, micOn, camOn, toggleMic, toggleCam, mutedByAdmin, error, selfStream, remoteStreams } = voice;
  const others = Object.entries(remoteStreams);
  const nameOf = (sid) => participants.find((p) => p.socketId === sid)?.name || 'peer';
  const anyVideo = (joined && camOn) || others.some(([, s]) => s.getVideoTracks().some((t) => t.enabled));

  return (
    <>
      {/* floating video grid */}
      {mode !== 'controls' && anyVideo && (
        <div className="absolute top-4 right-4 z-30 flex flex-col gap-2 w-44 pointer-events-none">
          {camOn && selfStream && (
            <div className="pointer-events-auto">
              <VideoTile stream={selfStream} label="You" muted />
            </div>
          )}
          {others.map(([sid, stream]) => (
            <div key={sid} className="pointer-events-auto">
              <VideoTile stream={stream} label={nameOf(sid)} />
            </div>
          ))}
        </div>
      )}

      {/* controls */}
      {mode !== 'videos' && (
        <div className="flex items-center gap-2 flex-wrap">
          {!joined ? (
            <button className="btn-ghost text-xs px-3 py-1.5" onClick={joinVoice} title="Join voice & camera">🎙️ Join Voice</button>
          ) : (
            <>
              <button
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition ${mutedByAdmin ? 'bg-red-950/60 text-red-300 border-red-800' : micOn ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700' : 'bg-nest-800 text-slate-400 border-nest-600'}`}
                onClick={toggleMic}
                title={mutedByAdmin ? 'Muted by admin' : micOn ? 'Mute mic' : 'Unmute mic'}
              >
                {mutedByAdmin ? '🔇 (admin)' : micOn ? '🎙️' : '🔇'}
              </button>
              <button
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition ${camOn ? 'bg-indigo-900/50 text-indigo-300 border-indigo-700' : 'bg-nest-800 text-slate-400 border-nest-600'}`}
                onClick={toggleCam}
                title={camOn ? 'Turn camera off' : 'Turn camera on'}
              >
                {camOn ? '📹' : '📷'}
              </button>
              <button className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-red-950/60 text-red-300 border border-red-800 hover:bg-red-900/60" onClick={leaveVoice} title="Leave voice">
                ⏏
              </button>
              {mutedByAdmin && <span className="text-[10px] text-red-300">Muted by admin</span>}
            </>
          )}
          {error && <span className="text-[10px] text-red-400">{error}</span>}
        </div>
      )}
    </>
  );
}

function VideoTile({ stream, label, muted }) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-nest-600 bg-nest-950 shadow-lg">
      <video
        ref={(v) => {
          if (v) {
            v.srcObject = stream;
            v.play().catch(() => {});
          }
        }}
        autoPlay
        playsInline
        muted={!!muted}
        className="w-full aspect-video object-cover"
      />
      <span className="absolute bottom-1 left-1.5 text-[10px] font-semibold text-white bg-black/60 rounded px-1.5">{label}</span>
    </div>
  );
}
