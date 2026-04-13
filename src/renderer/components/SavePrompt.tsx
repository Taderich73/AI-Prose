interface SavePromptProps {
  fileName: string
  onSave: () => void
  onDontSave: () => void
  onCancel: () => void
}

export function SavePrompt({
  fileName,
  onSave,
  onDontSave,
  onCancel,
}: SavePromptProps) {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">Unsaved Changes</div>
        <div className="dialog-body">
          <p>Do you want to save changes to {fileName}?</p>
          <div className="dialog-actions">
            <button onClick={onDontSave}>Don't Save</button>
            <button onClick={onCancel}>Cancel</button>
            <button className="dialog-primary" onClick={onSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
