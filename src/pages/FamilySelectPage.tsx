import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { formatCurrency } from '../utils/calculations';
import { AddMemberModal } from '../components/AddMemberModal';
import { ChevronRight, Plus, Users } from 'lucide-react';

interface FamilySelectPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const FamilySelectPage: React.FC<FamilySelectPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const { members, setActiveMemberId, addMember, getPortfolioSummary } = useInvestments();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSelect = (id: string) => {
    setActiveMemberId(id);
    navigate('/home');
  };

  const handleAddMember = (name: string, role: string, avatar: string) => {
    addMember(name, role, avatar);
    onShowToast(`Added ${name} (${role}) to family vault!`, 'success');
    navigate('/home');
  };

  return (
    <div className="main-content fade-in">
      <div className="family-select-header">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--brand-primary)', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          <Users size={16} />
          <span>Family Portfolio Hub</span>
        </div>
        <h1 className="family-select-title">Who's Investments Are We Viewing?</h1>
        <p className="family-select-desc">
          Select a family member to view their complete portfolio distribution and manage their Fixed Deposits.
        </p>
      </div>

      <div className="family-grid-desktop">
        {members.map((member) => {
          const summary = getPortfolioSummary(member);
          const fdCount = member.fds?.length || 0;

          return (
            <div
              key={member.id}
              className="family-card-desktop"
              onClick={() => handleSelect(member.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelect(member.id);
                }
              }}
            >
              <div className="member-avatar-box">{member.avatar || '🧑'}</div>
              <div className="member-details-col">
                <span className="member-role-badge">{member.role}</span>
                <h2 className="member-card-title">{member.name}</h2>
                <div className="member-meta-stats">
                  <span className="member-total-val">₹ {formatCurrency(summary.total)} Total</span>
                  <span>•</span>
                  <span className="member-fd-pill">{fdCount} {fdCount === 1 ? 'FD' : 'FDs'} Active</span>
                </div>
              </div>
              <ChevronRight size={22} className="family-card-arrow" style={{ color: 'var(--text-muted)' }} />
            </div>
          );
        })}

        {/* Add Family Member Card */}
        <button
          type="button"
          className="family-card-desktop add-member-card-btn"
          onClick={() => setIsModalOpen(true)}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--brand-primary-bg)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={24} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>Add Family Member</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Add spouse, parent, or child</div>
          </div>
        </button>
      </div>

      <AddMemberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddMember={handleAddMember}
      />
    </div>
  );
};
