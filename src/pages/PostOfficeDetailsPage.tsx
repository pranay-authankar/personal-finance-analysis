import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { PostOfficeDetailsPanel } from '../components/PostOfficeDetailsPanel';
import { ChevronLeft } from 'lucide-react';

interface PostOfficeDetailsPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const PostOfficeDetailsPage: React.FC<PostOfficeDetailsPageProps> = ({ onShowToast }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPostOfficeById, activeMember } = useInvestments();

  const inv = id ? getPostOfficeById(id) : undefined;

  if (!inv) {
    return (
      <div className="main-content fade-in" style={{ maxWidth: '800px', margin: '60px auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
          Investment Record Not Found
        </h2>
        <p style={{ color: '#64748B', margin: '12px 0 24px', fontSize: '14px' }}>
          This Post Office investment may have been removed or does not belong to {activeMember?.name || 'your'} portfolio.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/post-office')}>
          Return to Post Office Dashboard
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
          onClick={() => navigate('/post-office')}
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
          <span>Back to Post Office</span>
        </button>
      </div>

      {/* Clean Details Panel Card */}
      <div className="po-details-page-wrapper">
        <PostOfficeDetailsPanel
          investment={inv}
          onShowToast={onShowToast}
          isDrawer={false}
        />
      </div>
    </div>
  );
};
