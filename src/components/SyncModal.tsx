import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  RefreshCw,
  Laptop,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Clock,
  Wifi,
  Lock,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import type {
  HostSessionInfo,
  SyncPlan,
  ConflictResolutionPolicy,
  VaultAllRecords
} from '../../electron/types.ts';
import { useInvestments } from '../context/InvestmentContext';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

type SyncTab = 'client' | 'host' | 'revocation';

export const SyncModal: React.FC<SyncModalProps> = ({ isOpen, onClose, onShowToast }) => {
  const { refreshData } = useInvestments();
  const [activeTab, setActiveTab] = useState<SyncTab>('client');

  // Host state
  const [isHostRunning, setIsHostRunning] = useState(false);
  const [hostSession, setHostSession] = useState<HostSessionInfo | null>(null);
  const [hostPin, setHostPin] = useState<string>('');
  const [hostIps, setHostIps] = useState<string[]>([]);
  const [hostCountdown, setHostCountdown] = useState<number>(300);
  const [hostError, setHostError] = useState<string | null>(null);
  const [hostLoading, setHostLoading] = useState(false);

  // Client state
  const [hostIpInput, setHostIpInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isClientConnected, setIsClientConnected] = useState(false);
  const [syncPlan, setSyncPlan] = useState<SyncPlan | null>(null);
  const [resolutionPolicy, setResolutionPolicy] = useState<ConflictResolutionPolicy>('keep_local');
  const [syncResult, setSyncResult] = useState<{ appliedCount?: number; backupPath?: string } | null>(null);

  // Revocation state
  const [revokedList, setRevokedList] = useState<string[]>([]);
  const [deviceToRevoke, setDeviceToRevoke] = useState('');

  const countdownRef = useRef<any>(null);

  // Initialize IPs and revoked devices on open
  useEffect(() => {
    if (!isOpen) return;

    if (window.vaultApi?.sync) {
      window.vaultApi.sync.getLocalIps().then((ips) => {
        setHostIps(ips);
        if (ips.length > 0 && !hostIpInput) {
          const first = ips[0];
          setHostIpInput(`${first}:8765`);
        }
      }).catch(() => {});

      window.vaultApi.sync.getPairedDevices().then((list) => {
        setRevokedList(list.filter((d) => d.isRevoked).map((d) => d.deviceId));
      }).catch(() => {});
    }
  }, [isOpen]);

  // Host countdown ticker
  useEffect(() => {
    if (isHostRunning && hostCountdown > 0) {
      countdownRef.current = setInterval(() => {
        setHostCountdown((c) => {
          if (c <= 1) {
            handleStopHost();
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isHostRunning, hostCountdown]);

  if (!isOpen) return null;

  // --- Host handlers ---
  const handleStartHost = async () => {
    if (!window.vaultApi?.sync) {
      setHostError('Direct host sync is only available on desktop or supported environments.');
      return;
    }
    setHostLoading(true);
    setHostError(null);
    try {
      const res = await window.vaultApi.sync.startHost();
      if (res && res.sessionInfo) {
        setIsHostRunning(true);
        setHostSession(res.sessionInfo);
        setHostPin(res.pin);
        setHostCountdown(300);
        onShowToast?.('Sync host started. Enter the PIN on your other device.', 'info');
      } else {
        setHostError('Failed to start sync host.');
      }
    } catch (err: unknown) {
      setHostError(err instanceof Error ? err.message : String(err));
    } finally {
      setHostLoading(false);
    }
  };

  const handleStopHost = async () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (window.vaultApi?.sync) {
      await window.vaultApi.sync.stopHost();
    }
    setIsHostRunning(false);
    setHostSession(null);
    setHostPin('');
  };

  // --- Client handlers ---
  const handleConnectAndReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.vaultApi?.sync) {
      setClientError('Sync service is not available on this platform.');
      return;
    }

    const hostAddress = hostIpInput.trim();
    const pin = pinInput.trim();

    if (!hostAddress) {
      setClientError('Please enter the host IP address.');
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setClientError('PIN must be exactly 6 numeric digits.');
      return;
    }

    setClientLoading(true);
    setClientError(null);
    setSyncPlan(null);
    setSyncResult(null);

    try {
      let hostIp = hostAddress;
      let port = 8765;
      if (hostAddress.includes(':')) {
        const parts = hostAddress.split(':');
        hostIp = parts[0];
        port = parseInt(parts[1], 10) || 8765;
      }

      // 1. Handshake & Authenticate
      const connRes = await window.vaultApi.sync.connectClient({
        hostIp,
        port,
        pin
      });

      if (!connRes || !connRes.hostDevice) {
        setClientError('Authentication failed. Check IP and PIN.');
        setClientLoading(false);
        return;
      }

      setIsClientConnected(true);

      // 2. Fetch remote records & generate diff plan
      const plan = await window.vaultApi.sync.previewSync({} as VaultAllRecords);
      setSyncPlan(plan);
    } catch (err: unknown) {
      setClientError(err instanceof Error ? err.message : String(err));
    } finally {
      setClientLoading(false);
    }
  };

  const handleExecuteMerge = async () => {
    if (!window.vaultApi?.sync || !isClientConnected) return;

    setClientLoading(true);
    setClientError(null);

    try {
      const execRes = await window.vaultApi.sync.executeSync({
        policy: resolutionPolicy
      });

      if (execRes.success) {
        const totalApplied = (execRes.recordsInserted || 0) + (execRes.recordsUpdated || 0);
        setSyncResult({
          appliedCount: totalApplied,
          backupPath: execRes.backupPath
        });
        onShowToast?.(`Sync successful! ${totalApplied} changes applied.`, 'success');
        await refreshData();
      } else {
        setClientError(execRes.error || 'Failed to apply synchronized changes.');
      }
    } catch (err: unknown) {
      setClientError(err instanceof Error ? err.message : String(err));
    } finally {
      setClientLoading(false);
    }
  };

  // --- Revocation handler ---
  const handleRevokeDevice = async () => {
    if (!deviceToRevoke.trim() || !window.vaultApi?.sync) return;
    const ok = await window.vaultApi.sync.revokeDevice(deviceToRevoke.trim());
    if (ok) {
      const updated = await window.vaultApi.sync.getPairedDevices();
      setRevokedList(updated.filter((d) => d.isRevoked).map((d) => d.deviceId));
      setDeviceToRevoke('');
      onShowToast?.('Device successfully revoked.', 'info');
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="sync-modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div className="sync-modal-card" style={{
        background: '#1e293b',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '640px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        color: '#f8fafc',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(56, 189, 248, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <RefreshCw size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#f8fafc' }}>
                Secure Device Sync
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Direct P2P Encrypted Wi-Fi Sync between Windows Desktop & Android
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isHostRunning) handleStopHost();
              onClose();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px'
            }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.3)'
        }}>
          <button
            onClick={() => setActiveTab('client')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: activeTab === 'client' ? 'rgba(255, 255, 255, 0.05)' : 'none',
              border: 'none',
              borderBottom: activeTab === 'client' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'client' ? '#38bdf8' : '#94a3b8',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <ArrowRight size={16} />
            Connect & Pull (Client)
          </button>

          <button
            onClick={() => setActiveTab('host')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: activeTab === 'host' ? 'rgba(255, 255, 255, 0.05)' : 'none',
              border: 'none',
              borderBottom: activeTab === 'host' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'host' ? '#38bdf8' : '#94a3b8',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <Wifi size={16} />
            Share Vault (Host)
          </button>

          <button
            onClick={() => setActiveTab('revocation')}
            style={{
              padding: '12px 16px',
              background: activeTab === 'revocation' ? 'rgba(255, 255, 255, 0.05)' : 'none',
              border: 'none',
              borderBottom: activeTab === 'revocation' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'revocation' ? '#38bdf8' : '#94a3b8',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <ShieldCheck size={16} />
            Devices
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* TAB 1: CLIENT MODE */}
          {activeTab === 'client' && (
            <div>
              {!syncPlan && !syncResult && (
                <form onSubmit={handleConnectAndReview}>
                  <div style={{
                    background: 'rgba(56, 189, 248, 0.06)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    borderRadius: '10px',
                    padding: '14px',
                    marginBottom: '20px',
                    fontSize: '13px',
                    color: '#cbd5e1',
                    display: 'flex',
                    gap: '10px'
                  }}>
                    <Lock size={18} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>Zero-Knowledge Mutual Pairing:</strong> An ephemeral ECDH keypair and HKDF session key protect all packets with AES-256-GCM. No passwords or master encryption keys are ever shared.
                    </div>
                  </div>

                  {clientError && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      padding: '12px',
                      color: '#fca5a5',
                      fontSize: '13px',
                      marginBottom: '16px',
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center'
                    }}>
                      <AlertCircle size={16} />
                      <span>{clientError}</span>
                    </div>
                  )}

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                      Host IP Address (from your other device)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 192.168.1.100:8765"
                      value={hostIpInput}
                      onChange={(e) => setHostIpInput(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#0f172a',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                      6-Digit Pairing PIN
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 842193"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                      required
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        background: '#0f172a',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        color: '#38bdf8',
                        fontSize: '20px',
                        fontWeight: 700,
                        letterSpacing: '4px',
                        textAlign: 'center',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={clientLoading}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: clientLoading ? 'not-allowed' : 'pointer',
                      opacity: clientLoading ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {clientLoading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Connecting & Verifying Handshake...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={18} />
                        <span>Connect & Compare Vaults</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* REVIEW SCREEN */}
              {syncPlan && !syncResult && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                    Sync Comparison Plan
                  </h3>
                  <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
                    Mutual authentication verified. Review incoming changes before committing to local encrypted storage.
                  </p>

                  {/* Badges */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#4ade80' }}>{syncPlan.totalInserts}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>New Records</div>
                    </div>
                    <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8' }}>{syncPlan.totalIdentical}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Identical</div>
                    </div>
                    <div style={{ background: syncPlan.totalConflicts > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.05)', border: syncPlan.totalConflicts > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: syncPlan.totalConflicts > 0 ? '#fbbf24' : '#94a3b8' }}>{syncPlan.totalConflicts}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Conflicts</div>
                    </div>
                    <div style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#c084fc' }}>{syncPlan.missingAttachments.length}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Attachments</div>
                    </div>
                  </div>

                  {/* Conflict policy selector */}
                  {syncPlan.totalConflicts > 0 && (
                    <div style={{ background: '#0f172a', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                        <AlertTriangle size={16} />
                        <span>Conflicting Records Detected ({syncPlan.totalConflicts})</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '10px' }}>
                        Records exist on both devices with differing values. Select how you would like to resolve them:
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="policy"
                            checked={resolutionPolicy === 'keep_local'}
                            onChange={() => setResolutionPolicy('keep_local')}
                          />
                          <span>Keep Local (Preserve this device's values)</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="policy"
                            checked={resolutionPolicy === 'use_remote'}
                            onChange={() => setResolutionPolicy('use_remote')}
                          />
                          <span>Use Incoming (Overwrite with host values)</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Safety Notice */}
                  <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.03)', padding: '10px 12px', borderRadius: '6px', marginBottom: '20px' }}>
                    <ShieldCheck size={16} style={{ color: '#4ade80', flexShrink: 0 }} />
                    <span>
                      An encrypted backup is automatically created prior to applying changes. If validation or foreign keys fail, changes are rolled back with zero loss.
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setSyncPlan(null)}
                      style={{
                        padding: '10px 16px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={clientLoading}
                      onClick={handleExecuteMerge}
                      style={{
                        padding: '10px 20px',
                        background: '#0284c7',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: clientLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {clientLoading ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      <span>{clientLoading ? 'Applying Changes...' : 'Confirm & Merge Changes'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SUCCESS RESULT SCREEN */}
              {syncResult && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(34, 197, 94, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4ade80',
                    margin: '0 auto 16px auto'
                  }}>
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>
                    Sync Completed Successfully!
                  </h3>
                  <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
                    Applied {syncResult.appliedCount} changes into your local encrypted vault.
                  </p>
                  {syncResult.backupPath && (
                    <div style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      background: '#0f172a',
                      padding: '10px',
                      borderRadius: '8px',
                      marginBottom: '20px',
                      textAlign: 'left',
                      wordBreak: 'break-all'
                    }}>
                      <strong>Pre-sync recovery snapshot created:</strong>
                      <div style={{ color: '#cbd5e1', marginTop: '4px', fontFamily: 'monospace' }}>
                        {syncResult.backupPath}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setSyncResult(null);
                      setSyncPlan(null);
                      onClose();
                    }}
                    style={{
                      padding: '10px 24px',
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: HOST MODE */}
          {activeTab === 'host' && (
            <div>
              {!isHostRunning ? (
                <div>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '16px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <Laptop size={20} style={{ color: '#38bdf8' }} />
                      <strong style={{ fontSize: '14px' }}>Host Sync Server</strong>
                    </div>
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                      Start a temporary, encrypted sync server on your local Wi-Fi. Your Android device or secondary desktop can connect to this device to exchange records.
                    </p>
                  </div>

                  {hostError && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      padding: '12px',
                      color: '#fca5a5',
                      fontSize: '13px',
                      marginBottom: '16px',
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center'
                    }}>
                      <AlertCircle size={16} />
                      <span>{hostError}</span>
                    </div>
                  )}

                  <button
                    onClick={handleStartHost}
                    disabled={hostLoading}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '8px',
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: hostLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {hostLoading ? <RefreshCw size={18} className="animate-spin" /> : <Wifi size={18} />}
                    <span>Start Local Sync Host</span>
                  </button>
                </div>
              ) : (
                <div>
                  {/* Host Active Card */}
                  <div style={{
                    background: '#0f172a',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '20px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#4ade80',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: 'rgba(34, 197, 94, 0.1)',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      marginBottom: '12px'
                    }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }} />
                      Listening for connections on port {hostSession?.port || 8765}
                    </div>

                    <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                      ONE-TIME PAIRING PIN
                    </div>
                    <div style={{
                      fontSize: '36px',
                      fontWeight: 800,
                      color: '#38bdf8',
                      letterSpacing: '8px',
                      marginBottom: '8px',
                      fontFamily: 'monospace'
                    }}>
                      {hostPin || '------'}
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      color: '#94a3b8'
                    }}>
                      <Clock size={14} />
                      <span>PIN expires in {formatSeconds(hostCountdown)}</span>
                    </div>
                  </div>

                  {/* Local Addresses */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                      Enter this address on your connecting device:
                    </div>
                    {hostIps.length > 0 ? (
                      hostIps.map((ip) => (
                        <div key={ip} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: '#0f172a',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          marginBottom: '4px',
                          fontFamily: 'monospace',
                          fontSize: '13px'
                        }}>
                          <span>{ip}:{hostSession?.port || 8765}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`${ip}:${hostSession?.port || 8765}`);
                              onShowToast?.('Address copied to clipboard', 'info');
                            }}
                            style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: '2px' }}
                            title="Copy address"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '13px', color: '#94a3b8' }}>127.0.0.1:{hostSession?.port || 8765}</div>
                    )}
                  </div>

                  <button
                    onClick={handleStopHost}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#fca5a5',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Stop Sync Host
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REVOCATION MODE */}
          {activeTab === 'revocation' && (
            <div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '20px',
                fontSize: '13px',
                color: '#cbd5e1'
              }}>
                Revoked devices are strictly rejected by the cryptographic handshake and cannot initiate or receive sync sessions.
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <input
                  type="text"
                  placeholder="Enter Device ID to revoke (e.g. dev_xxxx)"
                  value={deviceToRevoke}
                  onChange={(e) => setDeviceToRevoke(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '13px'
                  }}
                />
                <button
                  type="button"
                  onClick={handleRevokeDevice}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#fca5a5',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Revoke
                </button>
              </div>

              <div>
                <h4 style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 8px 0' }}>
                  Revoked Device Blacklist ({revokedList.length})
                </h4>
                {revokedList.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                    No devices currently revoked.
                  </p>
                ) : (
                  revokedList.map((id) => (
                    <div key={id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#0f172a',
                      borderRadius: '6px',
                      marginBottom: '6px',
                      fontSize: '12px',
                      fontFamily: 'monospace'
                    }}>
                      <span>{id}</span>
                      <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 600 }}>REVOKED</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
