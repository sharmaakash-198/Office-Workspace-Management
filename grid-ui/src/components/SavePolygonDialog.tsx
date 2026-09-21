import React, { useState } from 'react';

interface SavePolygonDialogProps {
  open: boolean;
  defaultLabel: string;
  onSave: (opts: { label: string; category: string; createCategory?: string }) => void;
  onCancel: () => void;
}

const SavePolygonDialog: React.FC<SavePolygonDialogProps> = ({
  open,
  defaultLabel,
  onSave,
  onCancel,
}) => {
  const [label, setLabel] = useState(defaultLabel);
  const [mode, setMode] = useState<'custom' | 'new'>('custom');
  const [newCategory, setNewCategory] = useState('');

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="modal-card save-polygon-dialog"
        role="dialog"
        aria-label="Save polygon"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2>Save polygon</h2>
        <label className="prop-field">
          <span>Label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <fieldset className="prop-section">
          <legend>Category</legend>
          <label className="radio-row">
            <input
              type="radio"
              checked={mode === 'custom'}
              onChange={() => setMode('custom')}
            />
            Custom
          </label>
          <label className="radio-row">
            <input
              type="radio"
              checked={mode === 'new'}
              onChange={() => setMode('new')}
            />
            Create new category
          </label>
          {mode === 'new' && (
            <input
              type="text"
              placeholder="e.g. walls"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
          )}
        </fieldset>
        <div className="prop-actions">
          <button type="button" className="toolbar-btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => {
              const cat =
                mode === 'new' ? newCategory.trim() || 'custom' : 'custom';
              onSave({
                label: label.trim() || defaultLabel,
                category: cat,
                createCategory: mode === 'new' ? cat : undefined,
              });
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SavePolygonDialog;
