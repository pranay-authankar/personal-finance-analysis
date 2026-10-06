import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { FdDetailsPanel } from '../components/FdDetailsPanel';
import { ChevronLeft } from 'lucide-react';

interface FdDetailsPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const FdDetailsPage: React.FC<FdDetailsPageProps> = ({ onShowToast }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getFdById, activeMember } = useInvestments();

  const fd = id ? getFdById(id) : undefined;

  if (!fd) {
    return (
      <div className="main-content fade-in" style={{ maxWidth: '800px', margin: '60px auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
          Fixed Deposit Not Found
        </h2>
        <p style={{ color: '#64748B', margin: '12px 0 24px', fontSize: '14px' }}>
          This record does not exist or has been removed from {activeMember?.name || 'your'} portfolio.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/fds')}>
          Return to Fixed Deposits
        </button>
      </div>
    );
  }

  return (
    <div className="main-content fade-in" style={{ maxWidth: '780px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => navigate('/fds')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: '#475569',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0
          }}
        >
          <ChevronLeft size={16} />
          <span>Back to Fixed Deposits</span>
        </button>
      </div>

      {/* Clean Details Panel Card */}
      <div className="fd-details-page-wrapper">
        <FdDetailsPanel
          fd={fd}
          onShowToast={onShowToast}
          isDrawer={false}
        />
      </div>
    </div>
  );
};
