import React, { useEffect, useRef, useState } from 'react';

export type PromptRequest = {
  title: string;
  message?: string;
  defaultValue?: string;
  confirmLabel?: string;
};

interface PromptToastProps {
  request: PromptRequest | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

/** In-app text prompt (replaces window.prompt). */
export const PromptToast: React.FC<PromptToastProps> = ({
  request,
  onSubmit,
  onCancel,
}) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (request) {
      setValue(request.defaultValue ?? '');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [request]);

  if (!request) return null;

  return (
    <div className="toast-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="toast-card"
        role="dialog"
        aria-label={request.title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3>{request.title}</h3>
        {request.message && <p className="panel-hint">{request.message}</p>}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit(value);
            if (e.key === 'Escape') onCancel();
          }}
        />
        <div className="prop-actions">
          <button type="button" className="toolbar-btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => onSubmit(value)}
          >
            {request.confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface MessageToastProps {
  message: string | null;
  onClose: () => void;
}

/** Brief message toast (replaces window.alert). */
export const MessageToast: React.FC<MessageToastProps> = ({ message, onClose }) => {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onClose, 3200);
    return () => window.clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="message-toast" role="status" onClick={onClose}>
      {message}
    </div>
  );
};
