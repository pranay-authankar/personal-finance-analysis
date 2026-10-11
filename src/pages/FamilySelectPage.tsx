import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { formatCurrency } from '../utils/calculations';
import { AddMemberModal } from '../components/AddMemberModal';
import { ChevronRight, Plus, Users, Trash2, ArrowRight } from 'lucide-react';

interface FamilySelectPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const FamilySelectPage: React.FC<FamilySelectPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const { members, setActiveMemberId, addMember, deleteMember, getPortfolioSummary } = useInvestments();
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

  const handleDeleteMember = (e: React.MouseEvent, memberId: string, memberName: string) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Remove family member "${memberName}" from the vault?\n\nThis will remove their profile record from family_members.csv.`
    );
    if (confirmed) {
      deleteMember(memberId);
      onShowToast(`Removed ${memberName} from family vault.`, 'info');
    }
  };

  return (
    <div className="main-content fade-in">
      <div className="family-select-header">
        <div className="family-select-kicker">
          <Users size={16} />
          <span>Family Portfolio Hub</span>
        </div>
        <h1 className="family-select-title">Who's Investments Are We Viewing?</h1>
        <p className="family-select-desc">
          Select a family member to view their complete portfolio distribution and manage their investments.
        </p>
      </div>

      {members.length === 0 ? (
        /* Empty State: No Members in CSV */
        <div className="members-empty-panel">
          <div className="members-empty-icon-box">
            <Users size={44} strokeWidth={1.8} />
          </div>
          <h2 className="members-empty-headline">No Family Profiles Yet</h2>
          <p className="members-empty-subtext">
            Your FamilyVault is clean and initialized. Add your first family member profile to begin
            organizing Fixed Deposits, Post Office schemes, Bullions, and Real Estate.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Add First Family Member</span>
            <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        /* Grid of Member Cards */
        <div className="family-grid-desktop">
          {members.map((member) => {
            const summary = getPortfolioSummary(member);
            const fdCount = member.fds?.length || 0;
            const poCount = member.postOfficeInvestments?.length || 0;
            const totalActiveAssets =
              fdCount +
              poCount +
              (member.bullionsInvestments?.length || 0) +
              (member.properties?.length || 0);

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
                    <span className="member-fd-pill">
                      {totalActiveAssets} {totalActiveAssets === 1 ? 'Asset' : 'Assets'}
                    </span>
                  </div>
                </div>

                <div className="member-card-actions">
                  <button
                    type="button"
                    className="member-delete-btn"
                    onClick={(e) => handleDeleteMember(e, member.id, member.name)}
                    title={`Remove ${member.name}`}
                    aria-label={`Remove ${member.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                  <ChevronRight size={22} className="family-card-arrow" />
                </div>
              </div>
            );
          })}

          {/* Add Family Member Card */}
          <button
            type="button"
            className="family-card-desktop add-member-card-btn"
            onClick={() => setIsModalOpen(true)}
          >
            <div className="add-member-circle-icon">
              <Plus size={24} strokeWidth={2.5} />
            </div>
            <div>
              <div className="add-member-label">Add Family Member</div>
              <div className="add-member-sublabel">Add spouse, parent, or child</div>
            </div>
          </button>
        </div>
      )}

      <AddMemberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddMember={handleAddMember}
      />
    </div>
  );
};
