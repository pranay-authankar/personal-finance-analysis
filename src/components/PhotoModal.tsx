import React from 'react';
import { X, ZoomIn } from 'lucide-react';

interface PhotoModalProps {
  photoUrl: string | null;
  onClose: () => void;
}

export const PhotoModal: React.FC<PhotoModalProps> = ({ photoUrl, onClose }) => {
  if (!photoUrl) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="photo-viewer-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-main)' }}>
            <ZoomIn size={18} />
            <span>FD Certificate / Receipt Document</span>
          </div>
          <button type="button" className="btn btn-subtle btn-sm" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <img src={photoUrl} alt="FD Certificate" className="enlarged-photo" />
      </div>
    </div>
  );
};
