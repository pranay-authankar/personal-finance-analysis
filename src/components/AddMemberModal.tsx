import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMember: (name: string, role: string, avatar: string) => void;
}

const AVATARS = ['👨', '👩', '🧑', '👴', '👵', '👧', '👦', '💼'];
const ROLES = ['Father', 'Mother', 'Self', 'Spouse', 'Son', 'Daughter', 'Grandparent', 'Other'];

export const AddMemberModal: React.FC<AddMemberModalProps> = ({ isOpen, onClose, onAddMember }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState(ROLES[0]);
  const [avatar, setAvatar] = useState(AVATARS[0]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddMember(name.trim(), role, avatar);
    setName('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="brand-icon" style={{ width: '32px', height: '32px' }}>
              <UserPlus size={18} />
            </div>
            <h3 className="modal-title">Add Family Member</h3>
          </div>
          <button type="button" className="btn btn-subtle btn-sm" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Choose Avatar Icon</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                {AVATARS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setAvatar(av)}
                    style={{
                      width: '44px',
                      height: '44px',
                      fontSize: '22px',
                      borderRadius: 'var(--radius-md)',
                      border: avatar === av ? '2px solid var(--brand-primary)' : '1px solid var(--border-medium)',
                      background: avatar === av ? 'var(--brand-primary-bg)' : 'var(--bg-surface)',
                      cursor: 'pointer'
                    }}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="memberNameInput" className="form-label">Full Name</label>
              <input
                id="memberNameInput"
                type="text"
                required
                className="form-input"
                placeholder="e.g. Ramesh Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="memberRoleSelect" className="form-label">Relationship / Role</label>
              <select
                id="memberRoleSelect"
                className="form-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
