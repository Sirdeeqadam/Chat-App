import { useRef, useState } from "react";

import api from "../services/api";
import { useLanguage } from "../context/LanguageContext";

const FileAttachmentPicker = ({
  disabled = false,
  onSendAttachment,
}) => {
  const { t } = useLanguage();
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || disabled || uploading) {
      return;
    }

    setError("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("attachment", file);

      const response = await api.post(
        "/messages/attachment",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      await onSendAttachment(response.data);
    } catch (uploadError) {
      setError(
        uploadError.response?.data?.message ||
          uploadError.message ||
          t.uploadFailed || "Failed to upload attachment."
      );
    } finally {
      setUploading(false);
    }
  };

  const openPicker = (inputRef) => {
    setOpen(false);
    inputRef.current?.click();
  };

  return (
    <span className="file-attachment-picker">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleChange}
      />

      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={handleChange}
      />

      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={handleChange}
      />

      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        hidden
        onChange={handleChange}
      />

      <button
        type="button"
        className="file-attachment-button"
        disabled={disabled || uploading}
        onClick={() => setOpen((previous) => !previous)}
        title={t.attachment}
        aria-label={t.attachment}
      >
        {uploading ? (
          "..."
        ) : (
          <svg
            className="attachment-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m20.5 11.5-8.7 8.7a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
          </svg>
        )}
      </button>

      {open && !uploading && (
        <div className="attachment-menu">
          <button
            type="button"
            disabled={disabled}
            onClick={() => openPicker(imageInputRef)}
          >
            {t.image}
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => openPicker(audioInputRef)}
          >
            {t.audio}
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => openPicker(videoInputRef)}
          >
            {t.video}
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => openPicker(documentInputRef)}
          >
            {t.document}
          </button>
        </div>
      )}

      {error && (
        <small className="file-attachment-error">
          {error}
        </small>
      )}
    </span>
  );
};

export default FileAttachmentPicker;
