import { useEffect, useRef, useState } from "react";

const SPEEDS = [1, 1.5, 2];

const formatTime = (value) => {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const VoiceMessagePlayer = ({ src }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
      return;
    }

    audio.pause();
    setPlaying(false);
  };

  const handleProgress = (event) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const progress = Math.min(
      1,
      Math.max(0, (event.clientX - bounds.left) / bounds.width)
    );
    const nextTime = progress * duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const cycleSpeed = () => {
    const nextSpeed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  return (
    <div className="voice-message-player">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onPause={() => setPlaying(false)}
        aria-hidden="true"
      />

      <button
        type="button"
        className="voice-message-play"
        onClick={togglePlayback}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="7" y="5" width="3.5" height="14" rx="1" />
            <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M8 5.5v13l10-6.5-10-6.5Z" />
          </svg>
        )}
      </button>

      <div className="voice-message-track-area">
        <button
          type="button"
          className="voice-message-wave"
          onClick={handleProgress}
          aria-label="Voice message progress"
        >
          {Array.from({ length: 32 }, (_, index) => (
            <span
              key={index}
              className={
                duration && index / 32 <= currentTime / duration
                  ? "played"
                  : ""
              }
              style={{ height: `${8 + ((index * 13) % 18)}px` }}
            />
          ))}
        </button>
        <div className="voice-message-time">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <button
        type="button"
        className="voice-message-speed"
        onClick={cycleSpeed}
        aria-label={`Playback speed ${speed}x. Change speed.`}
      >
        {speed}x
      </button>
    </div>
  );
};

export default VoiceMessagePlayer;
