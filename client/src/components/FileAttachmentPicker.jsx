import { useRef, useState } from "react";

import api from "../services/api";

const FileAttachmentPicker = ({
  disabled = false,
  onSendAttachment,
}) => {
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
          "Failed to upload attachment."
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
        title="Add attachment"
        aria-label="Add attachment"
      >
        {uploading ? "..." : "+"}
      </button>

      {open && !uploading && (
        <div className="attachment-menu">
          <button
            type="button"
            disabled={disabled}
            onClick={() => openPicker(imageInputRef)}
          >
            Image
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => openPicker(audioInputRef)}
          >
            Audio
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => openPicker(videoInputRef)}
          >
            Video
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => openPicker(documentInputRef)}
          >
            Document
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
