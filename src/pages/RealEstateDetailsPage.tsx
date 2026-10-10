import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { RealEstateDetailsPanel } from '../components/RealEstateDetailsPanel';
import { AddPropertyModal } from '../components/AddPropertyModal';
import { ChevronLeft } from 'lucide-react';
import type { PropertyRecord } from '../types';

interface RealEstateDetailsPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const RealEstateDetailsPage: React.FC<RealEstateDetailsPageProps> = ({ onShowToast }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPropertyById, activeMember } = useInvestments();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const property = id ? getPropertyById(id) : undefined;

  if (!property) {
    return (
      <div className="main-content fade-in" style={{ maxWidth: '800px', margin: '60px auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-navy)' }}>
          Property Record Not Found
        </h2>
        <p style={{ color: 'var(--color-charcoal-muted)', margin: '12px 0 24px', fontSize: '14px' }}>
          This record does not exist or has been removed from {activeMember?.name || 'your'} portfolio.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/real-estate')}>
          Return to Real Estate
        </button>
      </div>
    );
  }

  const handleEdit = (_p: PropertyRecord) => {
    setIsEditModalOpen(true);
  };

  return (
    <div className="main-content fade-in" style={{ maxWidth: '840px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => navigate('/real-estate')}
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
          <span>Back to Real Estate</span>
        </button>
      </div>

      {/* Clean Details Panel Card (Page Mode) */}
      <div className="bullion-details-page-wrapper">
        <RealEstateDetailsPanel
          property={property}
          onClose={() => navigate('/real-estate')}
          onEdit={handleEdit}
          onShowToast={onShowToast}
          isDrawer={false}
        />
      </div>

      {/* Edit Modal */}
      <AddPropertyModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        propertyToEdit={property}
        onShowToast={onShowToast}
      />
    </div>
  );
};

export default RealEstateDetailsPage;
