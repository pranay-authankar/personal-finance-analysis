import React, { useState } from 'react';
import { X, FileText, Upload, AlertCircle, Check, Loader2 } from 'lucide-react';
import { uploadDocumentFile } from '../utils/fileUpload';

interface AddDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyName: string;
  r_id?: string;
  onAddDocument: (document: { d_name: string; d_link: string; r_id?: string }) => void | Promise<void>;
}

const DOCUMENT_NAME_PRESETS = [
  'Sale Deed',
  'Registry / Title Deed',
  'Agreement to Sell',
  'Property Tax Paid Receipt',
  'Khata / 7/12 Land Extract',
  'Possession / Allotment Letter',
  'Encumbrance Certificate (EC)',
  'Building Plan Sanction / RERA Approval',
  'Rent Agreement',
  'Other Document'
];

export const AddDocumentModal: React.FC<AddDocumentModalProps> = ({
  isOpen,
  onClose,
  propertyName,
  r_id,
  onAddDocument
}) => {
  const [documentName, setDocumentName] = useState<string>('Sale Deed');
  const [customName, setCustomName] = useState<string>('');
  const [fileUrl, setFileUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        setError('File size exceeds 8MB limit');
        return;
      }
      setFileName(file.name);
      setIsUploading(true);
      setError('');
      try {
        const uploadedUrl = await uploadDocumentFile(file);
        setFileUrl(uploadedUrl);
      } catch {
        setError('Failed to upload file. Please try again.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) {
      setError('Please wait for the file to finish uploading');
      return;
    }

    const finalName = documentName === 'Other Document' ? customName.trim() : documentName.trim();
    if (!finalName) {
      setError('Please specify the name of the document');
      return;
    }

    if (!fileUrl && !fileName) {
      setError('Please select a file to upload');
      return;
    }

    setIsSaving(true);
    try {
      await onAddDocument({
        d_name: finalName,
        d_link: fileUrl || `/uploads/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
        r_id
      });
      onClose();
    } catch {
      setError('Failed to save document. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px', padding: '24px 28px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)'
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Attach Document
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {propertyName} {r_id ? '• Rent Document' : '• Property Document'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-subtle btn-sm"
            onClick={onClose}
            style={{ padding: '6px' }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert-danger" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
              Document Type *
            </label>
            <select
              className="form-input"
              value={documentName}
              onChange={(e) => {
                setDocumentName(e.target.value);
                setError('');
              }}
              required
            >
              {DOCUMENT_NAME_PRESETS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {documentName === 'Other Document' && (
            <div>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
                Document Name *
              </label>
              <input
                type="text"
                className="form-input"
                value={customName}
                onChange={(e) => {
                  setCustomName(e.target.value);
                  setError('');
                }}
                placeholder="Enter document name (e.g. Society NOC, Electricity Meter Sanction)"
                required
                autoFocus
              />
            </div>
          )}

          <div>
            <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
              Select File to Upload *
            </label>
            <div
              style={{
                border: '2px dashed var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                textAlign: 'center',
                background: 'var(--bg-surface-subtle)',
                cursor: isUploading ? 'not-allowed' : 'pointer'
              }}
              onClick={() => {
                if (!isUploading) {
                  document.getElementById('file-upload-input')?.click();
                }
              }}
            >
              <input
                id="file-upload-input"
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              {isUploading ? (
                <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px', color: 'var(--color-primary)' }} />
              ) : (
                <Upload size={24} style={{ margin: '0 auto 8px', color: 'var(--text-muted)' }} />
              )}
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {isUploading ? (
                  <span>Uploading file, please wait...</span>
                ) : fileName ? (
                  <span style={{ color: '#16A34A' }}>✓ {fileName}</span>
                ) : (
                  'Click to select PDF, PNG, JPG, or WebP file'
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Files up to 8MB stored securely in offline vault
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isUploading || isSaving}>
              {isSaving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
              <span>{isSaving ? 'Saving...' : 'Save Document'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
