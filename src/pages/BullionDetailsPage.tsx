import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { BullionDetailsPanel } from '../components/BullionDetailsPanel';
import { AddBullionModal } from '../components/AddBullionModal';
import { ChevronLeft } from 'lucide-react';
import type { BullionInvestment } from '../types';

interface BullionDetailsPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const BullionDetailsPage: React.FC<BullionDetailsPageProps> = ({ onShowToast }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getBullionById, activeMember } = useInvestments();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const b = id ? getBullionById(id) : undefined;

  if (!b) {
    return (
      <div className="main-content fade-in" style={{ maxWidth: '800px', margin: '60px auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-navy)' }}>
          Bullion Record Not Found
        </h2>
        <p style={{ color: 'var(--color-charcoal-muted)', margin: '12px 0 24px', fontSize: '14px' }}>
          This record does not exist or has been removed from {activeMember?.name || 'your'} portfolio.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/bullions')}>
          Return to Bullions
        </button>
      </div>
    );
  }

  const handleEdit = (_bullion: BullionInvestment) => {
    setIsEditModalOpen(true);
  };

  return (
    <div className="main-content fade-in" style={{ maxWidth: '780px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => navigate('/bullions')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: 'var(--color-charcoal-light)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0
          }}
        >
          <ChevronLeft size={16} />
          <span>Back to Bullions</span>
        </button>
      </div>

      {/* Clean Details Panel Card (Page Mode) */}
      <div className="bullion-details-page-wrapper">
        <BullionDetailsPanel
          investment={b}
          onClose={() => navigate('/bullions')}
          onEdit={handleEdit}
          onShowToast={onShowToast}
          isDrawer={false}
        />
      </div>

      {/* Edit Modal */}
      <AddBullionModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        bullionToEdit={b}
        onShowToast={onShowToast}
      />
    </div>
  );
};
