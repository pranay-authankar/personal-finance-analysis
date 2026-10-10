import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { useDateTime } from '../context/DateTimeContext';
import { formatCurrency, formatDate, calculateFDValues } from '../utils/calculations';
import { getDeadlineClassification } from '../utils/deadlinesColorMap';
import { getEffectiveBullionValue } from '../utils/bullionCalculations';
import { parseLocalDate } from '../utils/dateUtils';
import {
  calculateNextMonthlyInterestDate,
  calculateNextQuarterlyInterestDate
} from '../utils/postOfficeCalculations';
import { DonutChart } from '../components/DonutChart';
import type { DeadlineClassification } from '../types';
import {
  Users,
  Plus,
  Layers,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Landmark,
  Coins,
  Building,
  Mail,
  Wallet
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { activeMember, getPortfolioSummary, calculatePropertyFinances } = useInvestments();
  const { now, midnightTicker } = useDateTime();
  const [showAddMenu, setShowAddMenu] = useState(false);

  if (!activeMember) return null;

  const summary = getPortfolioSummary();

  // 1. Active Assets breakdown
  const activeFds = useMemo(() => (activeMember.fds || []).filter((f) => !f.actualEndDate), [activeMember]);
  const activePos = useMemo(() => (activeMember.postOfficeInvestments || []).filter((p) => p.status === 'active'), [activeMember]);
  const activeBul = useMemo(() => (activeMember.bullionsInvestments || []).filter((b) => b.status === 'active'), [activeMember]);
  const activeProps = useMemo(
    () => (activeMember.properties || []).filter((p) => (p.property_status || 'ACTIVE') === 'ACTIVE'),
    [activeMember]
  );
  const totalActiveCount = activeFds.length + activePos.length + activeBul.length + activeProps.length;

  // 2. Receivables Calculation
  const { totalReceivables, receivablesCount } = useMemo(() => {
    let total = 0;
    let count = 0;

    (activeMember.properties || []).forEach((p) => {
      const fin = calculatePropertyFinances(p.p_id);
      if (fin.saleReceivableLeft > 0) {
        total += fin.saleReceivableLeft;
        count++;
      }
    });

    (activeMember.rents || []).forEach((r) => {
      if (r.next_rent_due && Number(r.rent_amount) > 0) {
        total += Number(r.rent_amount);
        count++;
      }
    });

    return { totalReceivables: total, receivablesCount: count };
  }, [activeMember, calculatePropertyFinances, midnightTicker, now]);

  // 3. Upcoming Events (sorted by nearest date)
  const upcomingList = useMemo(() => {
    const events: Array<{
      id: string;
      title: string;
      category: string;
      date: string;
      amount: number;
      route: string;
      badge: DeadlineClassification;
    }> = [];

    // FDs
    activeFds.forEach((f) => {
      if (f.maturityDate) {
        const badge = getDeadlineClassification(f.maturityDate, now);
        if (badge) {
          const calc = calculateFDValues(f.principal, f.interestRate, f.startDate, f.maturityDate);
          events.push({
            id: `fd_${f.id}`,
            title: `${f.bankName} FD`,
            category: 'Fixed Deposit',
            date: f.maturityDate,
            amount: calc.maturityAmount || f.principal,
            route: `/fds/${f.id}`,
            badge
          });
        }
      }
    });

    // Post Office
    activePos.forEach((p) => {
      const isRd =
        p.schemeType === 'RD' ||
        (p.schemeName ? p.schemeName.toLowerCase().includes('recurring') || p.schemeName.toLowerCase().includes('(rd)') : false);
      const isMis =
        p.schemeType === 'MIS' ||
        (p.schemeName ? p.schemeName.toLowerCase().includes('monthly income') || p.schemeName.toLowerCase().includes('(mis)') : false);
      const isScss =
        p.schemeType === 'SCSS' ||
        (p.schemeName ? p.schemeName.toLowerCase().includes('senior citizen') || p.schemeName.toLowerCase().includes('(scss)') : false);

      if (isRd) {
        // RD has regular monthly recurring deposits.
        // Track the next installment due date, never the 5-year (60/61-month) maturity date!
        const nextDate = p.nextDepositDate || (p.openingDate ? calculateNextMonthlyInterestDate(p.openingDate, now) : '');
        const amount = p.upcomingDepositAmount || p.monthlyDeposit || (p as any).monthlyInstallment || 0;
        if (nextDate) {
          const badge = getDeadlineClassification(nextDate, now);
          if (badge) {
            events.push({
              id: `po_dep_${p.id}`,
              title: `${p.schemeName} Installment`,
              category: 'Post Office',
              date: nextDate,
              amount,
              route: `/post-office/${p.id}`,
              badge
            });
          }
        } else if (p.maturityDate && (p.depositsMadeCount || 0) >= 60) {
          // All 60 deposits completed, waiting for maturity
          const badge = getDeadlineClassification(p.maturityDate, now);
          if (badge) {
            events.push({
              id: `po_mat_${p.id}`,
              title: `${p.schemeName} Maturity`,
              category: 'Post Office',
              date: p.maturityDate,
              amount: p.maturityAmount || p.amount,
              route: `/post-office/${p.id}`,
              badge
            });
          }
        }
      } else if (isMis) {
        // MIS pays monthly interest
        const nextDate = p.nextInterestDate || (p.openingDate ? calculateNextMonthlyInterestDate(p.openingDate, now) : '');
        const amount = p.expectedMonthlyInterest || p.monthlyPayout || 0;
        if (nextDate) {
          const badge = getDeadlineClassification(nextDate, now);
          if (badge) {
            events.push({
              id: `po_int_${p.id}`,
              title: `${p.schemeName} Payout`,
              category: 'Post Office',
              date: nextDate,
              amount,
              route: `/post-office/${p.id}`,
              badge
            });
          }
        }
      } else if (isScss) {
        // SCSS pays quarterly interest
        const nextDate = p.nextInterestDate || (p.openingDate ? calculateNextQuarterlyInterestDate(p.openingDate, now) : '');
        const amount = p.expectedQuarterlyInterest || p.quarterlyPayout || 0;
        if (nextDate) {
          const badge = getDeadlineClassification(nextDate, now);
          if (badge) {
            events.push({
              id: `po_int_${p.id}`,
              title: `${p.schemeName} Payout`,
              category: 'Post Office',
              date: nextDate,
              amount,
              route: `/post-office/${p.id}`,
              badge
            });
          }
        }
      } else {
        // Term Deposits (TD)
        if (p.maturityDate) {
          const badge = getDeadlineClassification(p.maturityDate, now);
          if (badge) {
            events.push({
              id: `po_mat_${p.id}`,
              title: `${p.schemeName}`,
              category: 'Post Office',
              date: p.maturityDate,
              amount: p.amount,
              route: `/post-office/${p.id}`,
              badge
            });
          }
        }
      }
    });

    // Bullions
    activeBul.forEach((b) => {
      if (b.paymentDueDate && (b.remainingPayment || 0) > 0) {
        const badge = getDeadlineClassification(b.paymentDueDate, now);
        if (badge) {
          events.push({
            id: `bul_${b.id}`,
            title: `${b.itemName} Balance Due`,
            category: 'Bullions',
            date: b.paymentDueDate,
            amount: b.remainingPayment || 0,
            route: `/bullions/${b.id}`,
            badge
          });
        }
      }
    });

    // Properties
    (activeMember.properties || []).forEach((p) => {
      const fin = calculatePropertyFinances(p.p_id);
      if (p.payment_deadline && fin.paymentLeft > 0) {
        const badge = getDeadlineClassification(p.payment_deadline, now);
        if (badge) {
          events.push({
            id: `prop_pay_${p.p_id}`,
            title: `${p.name} Balance Due`,
            category: 'Real Estate',
            date: p.payment_deadline,
            amount: fin.paymentLeft,
            route: `/real-estate/${p.p_id}`,
            badge
          });
        }
      }
      if (fin.saleReceivableLeft > 0 && fin.nextDueDate) {
        const badge = getDeadlineClassification(fin.nextDueDate, now);
        if (badge) {
          events.push({
            id: `prop_rec_${p.p_id}`,
            title: `${p.name} Receivable Due`,
            category: 'Real Estate',
            date: fin.nextDueDate,
            amount: fin.saleReceivableLeft,
            route: `/real-estate/${p.p_id}`,
            badge
          });
        }
      }
    });

    // Rents
    (activeMember.rents || []).forEach((r) => {
      if (r.next_rent_due && Number(r.rent_amount) > 0) {
        const badge = getDeadlineClassification(r.next_rent_due, now);
        if (badge) {
          events.push({
            id: `rent_${r.r_id}`,
            title: `Rent: ${r.tenant_name}`,
            category: 'Real Estate',
            date: r.next_rent_due,
            amount: Number(r.rent_amount),
            route: `/real-estate/${r.p_id}`,
            badge
          });
        }
      }
    });

    events.sort((a, b) => (parseLocalDate(a.date)?.getTime() || 0) - (parseLocalDate(b.date)?.getTime() || 0));
    return events;
  }, [activeFds, activePos, activeBul, activeMember, calculatePropertyFinances, midnightTicker, now]);

  // 4. Recent Activity (Meaningful transactions only)
  const recentActivityList = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      category: string;
      date: string;
      amount: number;
      isIncome: boolean;
      route?: string;
    }> = [];

    // Realized Funds
    (activeMember.realizedFunds || []).forEach((rf) => {
      if (rf.dateReceived) {
        list.push({
          id: `rf_${rf.id}`,
          title: `${rf.sourceName} (${rf.reason})`,
          category: rf.sourceCategory || 'Realized',
          date: rf.dateReceived,
          amount: rf.amount,
          isIncome: true,
          route: '/realized-funds'
        });
      }
    });

    // FDs
    (activeMember.fds || []).forEach((f) => {
      if (f.startDate) {
        list.push({
          id: `fd_start_${f.id}`,
          title: `${f.bankName} FD Booked`,
          category: 'Fixed Deposit',
          date: f.startDate,
          amount: f.principal,
          isIncome: false,
          route: `/fds/${f.id}`
        });
      }
    });

    // Bullions
    (activeMember.bullionsInvestments || []).forEach((b) => {
      if (b.purchaseDate && b.investedValue) {
        list.push({
          id: `bul_buy_${b.id}`,
          title: `${b.itemName} Acquired`,
          category: 'Bullions',
          date: b.purchaseDate,
          amount: getEffectiveBullionValue(b),
          isIncome: false,
          route: `/bullions/${b.id}`
        });
      }
    });

    // Properties
    (activeMember.properties || []).forEach((p) => {
      if (p.purchase_date && p.purchase_price) {
        list.push({
          id: `prop_buy_${p.p_id}`,
          title: `${p.name} Acquired`,
          category: 'Real Estate',
          date: p.purchase_date,
          amount: Number(p.purchase_price),
          isIncome: false,
          route: `/real-estate/${p.p_id}`
        });
      }
    });

    list.sort((a, b) => (parseLocalDate(b.date)?.getTime() || 0) - (parseLocalDate(a.date)?.getTime() || 0));
    return list.slice(0, 5);
  }, [activeMember]);

  const nextUpcomingEvent = upcomingList[0];

  return (
    <div className="main-content fade-in" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* Zero Data Banner (only if no members) */}
      {!activeMember.id && (
        <div
          style={{
            padding: '20px 24px',
            marginBottom: '24px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-navy)', margin: '0 0 2px 0' }}>
              Welcome to FamilyVault
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-charcoal-muted)', margin: 0 }}>
              Add your first family member to begin tracking your portfolio.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/family-select')}
          >
            <Users size={14} />
            <span>Add Member</span>
          </button>
        </div>
      )}

      {/* Top Header Bar: Active Member & Quick Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'var(--color-navy)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(15, 30, 54, 0.2)'
            }}
          >
            {activeMember.avatar || '👤'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-navy)', margin: 0, letterSpacing: '-0.02em' }}>
                {activeMember.name}
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface-subtle)',
                  color: 'var(--color-charcoal)',
                  border: '1px solid var(--border-card)'
                }}
              >
                {activeMember.role || 'Family Member'}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-charcoal-muted)', margin: '2px 0 0 0' }}>
              Executive Financial Overview
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
          <button
            type="button"
            onClick={() => navigate('/family-select')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-card)',
              color: 'var(--color-charcoal)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-hover)';
              e.currentTarget.style.color = 'var(--color-navy)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-card)';
              e.currentTarget.style.color = 'var(--color-charcoal)';
            }}
          >
            <Users size={14} />
            <span>Switch Member</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddMenu(!showAddMenu)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              background: 'var(--color-navy)',
              border: '1px solid var(--color-navy)',
              color: '#FFFFFF',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(15, 30, 54, 0.15)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-navy-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-navy)')}
          >
            <Plus size={15} />
            <span>Add Asset</span>
          </button>

          {/* Clean Add Asset Dropdown */}
          {showAddMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-card)',
                borderRadius: '10px',
                boxShadow: 'var(--shadow-lg)',
                padding: '6px',
                minWidth: '200px',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}
            >
              {[
                { label: 'Fixed Deposit (FD)', route: '/add-fd', icon: Landmark, color: 'var(--color-charcoal)' },
                { label: 'Bullions / Metals', route: '/add-bullion', icon: Coins, color: 'var(--color-gold)' },
                { label: 'Real Estate Property', route: '/add-property', icon: Building, color: 'var(--color-navy)' },
                { label: 'Post Office Scheme', route: '/add-post-office', icon: Mail, color: '#A16207' },
                { label: 'Realized Fund', route: '/add-realized-fund', icon: Wallet, color: '#0F766E' }
              ].map((item) => (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => {
                    setShowAddMenu(false);
                    navigate(item.route);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--color-charcoal-dark)',
                    fontSize: '13px',
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-soft)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <item.icon size={15} style={{ color: item.color }} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PRIMARY VISUAL ROW: Total Portfolio Value & Portfolio Distribution Donut */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 420px) 1fr',
          gap: '24px',
          marginBottom: '24px'
        }}
        className="dashboard-primary-visual-grid"
      >
        {/* 1. Large Total Portfolio Value Card */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: '14px',
            padding: '30px 28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-charcoal-light)',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--color-gold)',
                  display: 'inline-block'
                }}
              />
              <span>Total Portfolio Value</span>
            </div>

            <div
              style={{
                fontSize: '44px',
                fontWeight: 800,
                color: 'var(--color-navy)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                fontFamily: 'var(--font-family-display)'
              }}
            >
              <span style={{ color: 'var(--color-gold)', marginRight: '4px', fontWeight: 700 }}>₹</span>
              {formatCurrency(summary.total)}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginTop: '26px',
                padding: '14px 16px',
                background: 'var(--bg-surface-soft)',
                border: '1px solid var(--border-light)',
                borderRadius: '10px'
              }}
            >
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-charcoal-muted)', display: 'block' }}>
                  Active Holdings
                </span>
                <span
                  style={{
                    fontSize: '17px',
                    fontWeight: 700,
                    color: 'var(--color-navy)',
                    marginTop: '2px',
                    display: 'block'
                  }}
                >
                  ₹ {formatCurrency(summary.activeInvestmentsTotal)}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-charcoal-muted)', display: 'block' }}>
                  Realized Capital
                </span>
                <span
                  style={{
                    fontSize: '17px',
                    fontWeight: 700,
                    color: 'var(--color-navy)',
                    marginTop: '2px',
                    display: 'block'
                  }}
                >
                  ₹ {formatCurrency(summary.realizedFundsTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Direct Asset Links */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              marginTop: '26px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-light)'
            }}
          >
            {[
              { label: 'Real Estate', path: '/real-estate' },
              { label: 'Fixed Deposits', path: '/fds' },
              { label: 'Bullions', path: '/bullions' },
              { label: 'Post Office', path: '/post-office' },
              { label: 'Realized Funds', path: '/realized-funds' }
            ].map((btn) => (
              <button
                key={btn.path}
                type="button"
                onClick={() => navigate(btn.path)}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-charcoal)',
                  background: 'var(--bg-surface-soft)',
                  border: '1px solid var(--border-card)',
                  borderRadius: '6px',
                  padding: '4px 9px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-navy)';
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                  e.currentTarget.style.background = 'var(--bg-surface)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-charcoal)';
                  e.currentTarget.style.borderColor = 'var(--border-card)';
                  e.currentTarget.style.background = 'var(--bg-surface-soft)';
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Large Portfolio Distribution Donut Chart Card */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: '14px',
            padding: '30px 28px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px'
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-charcoal-light)'
              }}
            >
              Asset Allocation Distribution
            </div>
            <span style={{ fontSize: '11px', color: 'var(--color-charcoal-muted)', fontWeight: 600 }}>
              Hover segment to inspect
            </span>
          </div>

          <DonutChart portfolio={summary} />
        </div>
      </div>

      {/* SUMMARY METRIC CARDS (Exactly 3 Useful Summary Cards) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
          marginBottom: '28px'
        }}
        className="dashboard-summary-cards-grid"
      >
        {/* Card 1: Active Assets */}
        <div
          onClick={() => navigate('/fds')}
          role="button"
          tabIndex={0}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: '12px',
            padding: '22px 24px',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-hover)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-card)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
              Active Assets
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-navy)'
              }}
            >
              <Layers size={16} />
            </div>
          </div>

          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-navy)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {totalActiveCount}
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-charcoal-muted)', marginLeft: '6px' }}>
              Holdings
            </span>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--color-charcoal-muted)', marginTop: '6px', fontWeight: 500 }}>
            {activeFds.length} FDs · {activePos.length} Post Office · {activeBul.length} Bullions · {activeProps.length} Real Estate
          </div>
        </div>

        {/* Card 2: Upcoming Due / Maturity */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: '12px',
            padding: '22px 24px',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
              Upcoming Due / Maturity
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: upcomingList.length > 0 ? 'var(--color-gold-bg)' : 'var(--bg-surface-subtle)',
                border: upcomingList.length > 0 ? '1px solid var(--color-gold-border)' : '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: upcomingList.length > 0 ? 'var(--color-gold-dark)' : 'var(--color-charcoal-muted)'
              }}
            >
              <Clock size={16} />
            </div>
          </div>

          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-navy)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {upcomingList.length}
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-charcoal-muted)', marginLeft: '6px' }}>
              Pending
            </span>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--color-charcoal-muted)', marginTop: '6px', fontWeight: 500 }}>
            {nextUpcomingEvent ? (
              <span>
                Next event in <strong style={{ color: 'var(--color-navy)' }}>{nextUpcomingEvent.badge.daysLeft} days</strong> ({formatDate(nextUpcomingEvent.date)})
              </span>
            ) : (
              <span>All payment dues &amp; maturities clear</span>
            )}
          </div>
        </div>

        {/* Card 3: Receivable Amount */}
        <div
          onClick={() => navigate('/real-estate')}
          role="button"
          tabIndex={0}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: '12px',
            padding: '22px 24px',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-hover)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-card)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
              Receivable Amount
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: totalReceivables > 0 ? 'var(--color-emerald-bg)' : 'var(--bg-surface-subtle)',
                border: totalReceivables > 0 ? '1px solid var(--color-emerald-border)' : '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: totalReceivables > 0 ? 'var(--color-emerald)' : 'var(--color-charcoal-muted)'
              }}
            >
              <ArrowDownLeft size={16} />
            </div>
          </div>

          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-navy)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            <span style={{ color: 'var(--color-gold)', marginRight: '4px', fontWeight: 700 }}>₹</span>
            {formatCurrency(totalReceivables)}
          </div>

          <div style={{ fontSize: '12px', color: 'var(--color-charcoal-muted)', marginTop: '6px', fontWeight: 500 }}>
            {receivablesCount > 0
              ? `${receivablesCount} pending collection from sales & rent`
              : 'Zero uncollected receivables'}
          </div>
        </div>
      </div>

      {/* TWO COLUMN DETAIL SECTION: Upcoming Events & Recent Activity */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '24px'
        }}
        className="dashboard-two-column-grid"
      >
        {/* 4. Clean Upcoming Section */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: '14px',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px',
              paddingBottom: '14px',
              borderBottom: '1px solid var(--border-light)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} color="var(--color-navy)" />
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                Important Upcoming Events
              </h2>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'var(--bg-surface-subtle)',
                color: 'var(--color-charcoal)',
                border: '1px solid var(--border-light)'
              }}
            >
              {upcomingList.length} Scheduled
            </span>
          </div>

          {upcomingList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {upcomingList.slice(0, 5).map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => navigate(ev.route)}
                  role="button"
                  tabIndex={0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface-soft)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-surface)';
                    e.currentTarget.style.borderColor = 'var(--border-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-surface-soft)';
                    e.currentTarget.style.borderColor = 'var(--border-light)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: 700,
                        background: ev.badge.bgTint,
                        border: `1px solid ${ev.badge.borderTint}`,
                        color: ev.badge.textDark,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {ev.badge.relativeText}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'var(--color-navy)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {ev.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-charcoal-muted)', marginTop: '1px' }}>
                        {ev.category} · {formatDate(ev.date)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-navy)' }}>
                      ₹ {formatCurrency(ev.amount)}
                    </span>
                    <ChevronRight size={14} color="var(--color-charcoal-muted)" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                color: 'var(--color-charcoal-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle2 size={28} color="var(--color-emerald)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-navy)' }}>All upcoming events settled</span>
              <span style={{ fontSize: '11px', color: 'var(--color-charcoal-muted)' }}>No pending deadlines in the next 90 days</span>
            </div>
          )}
        </div>

        {/* 5. Small Recent Activity Section */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: '14px',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px',
              paddingBottom: '14px',
              borderBottom: '1px solid var(--border-light)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="var(--color-navy)" />
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                Recent Transactions
              </h2>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'var(--bg-surface-subtle)',
                color: 'var(--color-charcoal)',
                border: '1px solid var(--border-light)'
              }}
            >
              Activity
            </span>
          </div>

          {recentActivityList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentActivityList.map((act) => (
                <div
                  key={act.id}
                  onClick={() => {
                    if (act.route) navigate(act.route);
                  }}
                  role={act.route ? 'button' : undefined}
                  tabIndex={act.route ? 0 : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '11px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface-soft)',
                    cursor: act.route ? 'pointer' : 'default',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (act.route) {
                      e.currentTarget.style.background = 'var(--bg-surface)';
                      e.currentTarget.style.borderColor = 'var(--border-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (act.route) {
                      e.currentTarget.style.background = 'var(--bg-surface-soft)';
                      e.currentTarget.style.borderColor = 'var(--border-light)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: act.isIncome ? 'var(--color-emerald-bg)' : 'var(--bg-surface-subtle)',
                        border: act.isIncome ? '1px solid var(--color-emerald-border)' : '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: act.isIncome ? 'var(--color-emerald)' : 'var(--color-charcoal)',
                        flexShrink: 0
                      }}
                    >
                      {act.isIncome ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'var(--color-navy)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {act.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-charcoal-muted)', marginTop: '1px' }}>
                        {formatDate(act.date)}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: act.isIncome ? 'var(--color-emerald)' : 'var(--color-navy)'
                      }}
                    >
                      {act.isIncome ? '+ ' : ''}₹ {formatCurrency(act.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                color: 'var(--color-charcoal-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={24} color="var(--color-charcoal-muted)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-navy)' }}>No transaction history</span>
              <span style={{ fontSize: '11px', color: 'var(--color-charcoal-muted)' }}>Transactions appear as assets are added or realized</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
