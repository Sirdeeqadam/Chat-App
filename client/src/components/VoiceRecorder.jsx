import { useRef, useState } from "react";

import api from "../services/api";
import { useLanguage } from "../context/LanguageContext";

const VoiceRecorder = ({
  disabled = false,
  onSendVoice,
  onStarted,
}) => {
  const { t } = useLanguage();
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    if (disabled || recording || sending) {
      return;
    }

    setError("");

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(t.voiceRecordingUnsupported);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        stopStream();
        mediaRecorderRef.current = null;
        setRecording(false);

        if (!blob.size) {
          setError(t.noAudioRecorded);
          return;
        }

        try {
          setSending(true);
          const formData = new FormData();
          formData.append("audio", blob, "voice-message.webm");

          const response = await api.post("/messages/audio", formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });

          const attachmentUrl = response.data?.attachmentUrl;

          if (!attachmentUrl) {
            throw new Error(t.missingAudioUrl);
          }

          await onSendVoice(attachmentUrl);
        } catch (uploadError) {
          setError(
            uploadError.response?.data?.message ||
              uploadError.message ||
              t.failedVoiceUpload
          );
        } finally {
          setSending(false);
        }
      };

      recorder.start();
      setRecording(true);
      onStarted?.();
    } catch (recordingError) {
      stopStream();
      setError(
        recordingError.name === "NotAllowedError"
          ? t.microphonePermissionDenied
          : t.microphoneUnavailable
      );
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      return;
    }

    mediaRecorderRef.current.stop();
  };

  return (
    <span className="voice-recorder">
      <button
        type="button"
        className={recording ? "voice-record-button recording" : "voice-record-button"}
        disabled={disabled || sending}
        onClick={recording ? stopRecording : startRecording}
        title={recording ? t.stopRecording : t.recordVoiceMessage}
        aria-label={recording ? t.stopRecording : t.recordVoiceMessage}
      >
        {sending ? (
          <span aria-hidden="true">...</span>
        ) : recording ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            focusable="false"
          >
            <rect x="7" y="7" width="10" height="10" rx="1.5" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            focusable="false"
          >
            <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
            <path d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8" />
          </svg>
        )}
      </button>

      {error && <small className="voice-recorder-error">{error}</small>}
    </span>
  );
};

export default VoiceRecorder;
