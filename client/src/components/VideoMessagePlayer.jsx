import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import {
  formatMediaNumber,
  formatMediaTime,
} from "../i18n/formatMediaTime";

const SPEEDS = [1, 1.5, 2];

const VideoMessagePlayer = ({ src }) => {
  const { language, t } = useLanguage();
  const playerRef = useRef(null);
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPlaybackIcon, setShowPlaybackIcon] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const playbackIconTimerRef = useRef(null);
  const controlsTimerRef = useRef(null);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setSpeed(1);
    setShowPlaybackIcon(true);
    setShowControls(false);
  }, [src]);

  useEffect(() => {
    return () => {
      if (playbackIconTimerRef.current) {
        window.clearTimeout(playbackIconTimerRef.current);
      }

      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
      }
    };
  }, []);

  const revealPlaybackIcon = () => {
    setShowPlaybackIcon(true);

    if (playbackIconTimerRef.current) {
      window.clearTimeout(playbackIconTimerRef.current);
    }

    playbackIconTimerRef.current = window.setTimeout(() => {
      setShowPlaybackIcon(false);
    }, 5000);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const revealControls = () => {
    setShowControls(true);

    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }

    controlsTimerRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 5000);
  };

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;

    revealPlaybackIcon();
    revealControls();

    if (video.paused) {
      try {
        await video.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
      return;
    }

    video.pause();
    setPlaying(false);
  };

  const handleOverlayPlay = async () => {
    if (
      window.matchMedia("(max-width: 760px)").matches &&
      !document.fullscreenElement &&
      document.fullscreenEnabled &&
      playerRef.current
    ) {
      try {
        await playerRef.current.requestFullscreen();
      } catch {
        // Fullscreen can be blocked by the browser or platform.
      }
    }

    await togglePlayback();
  };

  const handleProgress = (event) => {
    const video = videoRef.current;
    if (!video || !duration) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const progress = Math.min(
      1,
      Math.max(0, (event.clientX - bounds.left) / bounds.width)
    );
    video.currentTime = progress * duration;
    setCurrentTime(video.currentTime);
  };

  const cycleSpeed = () => {
    const nextSpeed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
  };

  const enterPictureInPicture = async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // Picture-in-Picture can be blocked by the browser or platform.
    }
  };

  const toggleFullscreen = async () => {
    const player = playerRef.current;
    if (!player || !document.fullscreenEnabled) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await player.requestFullscreen();
      }
    } catch {
      // Fullscreen can be blocked by the browser or platform.
    }
  };

  return (
    <div
      ref={playerRef}
      className={`video-message-player${isFullscreen ? " is-fullscreen" : ""}`}
    >
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        playsInline
        onClick={togglePlayback}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
          setShowPlaybackIcon(true);
        }}
        onPause={() => {
          setPlaying(false);
        }}
        aria-label="Video attachment"
      />

      {showPlaybackIcon && (
        <button
          type="button"
          className="video-message-overlay-toggle"
          onClick={handleOverlayPlay}
          aria-label={playing ? "Pause video" : "Play video"}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 5v14M17 5v14" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 5 10 7-10 7Z" />
            </svg>
          )}
        </button>
      )}

      <div
        className={`video-message-controls${
          showControls ? " is-visible" : ""
        }`}
      >
        <button
          type="button"
          className="video-message-progress"
          onClick={handleProgress}
          aria-label="Video progress"
        >
          <span style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
        </button>

        <span className="video-message-time">
          {formatMediaTime(currentTime, language)}
          {t.mediaTimeSeparator}
          {formatMediaTime(duration, language)}
        </span>

        <div className="video-message-actions">
          <button
            type="button"
            className="video-message-fullscreen"
            onClick={toggleFullscreen}
            disabled={!document.fullscreenEnabled}
            aria-label="Fullscreen video"
            title="Fullscreen"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
            </svg>
          </button>

          <button
            type="button"
            className="video-message-pip"
            onClick={enterPictureInPicture}
            disabled={!document.pictureInPictureEnabled}
            aria-label="Picture in Picture"
            title="Picture in Picture"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <rect x="13" y="12" width="6" height="5" rx="1" />
            </svg>
          </button>

          <button
            type="button"
            className="video-message-speed"
            onClick={cycleSpeed}
            aria-label={`${t.mediaSpeedLabel} ${formatMediaNumber(speed, language)}${t.mediaSpeedSuffix}`}
            title={t.mediaSpeedLabel}
          >
            {formatMediaNumber(speed, language)}{t.mediaSpeedSuffix}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoMessagePlayer;