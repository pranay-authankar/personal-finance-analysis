# FamilyVault — Secure Device-to-Device Synchronization Design

**Version:** 1.0.0  
**Status:** Approved for Implementation (Step 5 of 5)  
**Authors:** FamilyVault Core Engineering Team  

---

## 1. Overview & Principles

FamilyVault is a privacy-first, local-only personal financial management application. Step 5 implements direct, secure device-to-device synchronization between Windows desktop and Android mobile devices (as well as desktop-to-desktop and mobile-to-mobile).

### Core Principles:
1. **Zero Central Infrastructure:** No cloud servers, remote databases, brokers, or external relays. All synchronization occurs directly over the local network (LAN / Wi-Fi subnet).
2. **Never Transmit Keys or Raw Database Files:** Master passwords, SQLCipher database encryption keys (MEK), and raw SQLite `.db` binary files are NEVER transmitted. Only validated, structured logical records and encrypted document payloads are exchanged.
3. **End-to-End Cryptographic Security:** All transit data is protected by ephemeral authenticated encryption (AEAD AES-256-GCM) with ephemeral ECDH key exchange and short-lived, user-approved pairing PINs (PAKE-derived session keys).
4. **Deterministic Conflict Resolution & No Silent Overwrites:** Clashing records are detected deterministically, presented clearly to the user, and resolved strictly according to user policy.
5. **Transactional Integrity & Pre-Sync Snapshot:** All incoming changes are committed within an atomic database transaction. If any failure occurs, the database rolls back completely to its pre-sync recovery point.

---

## 2. Supported Device Pairs & Network Requirements

| Pair Type | Network Transport | Protocol |
| :--- | :--- | :--- |
| **Windows Desktop <-> Android Mobile** | Local Wi-Fi / LAN Subnet | Direct TCP / HTTP+WebSocket with Application-Layer AES-256-GCM |
| **Windows Desktop <-> Windows Desktop** | Local Wi-Fi / LAN Subnet | Direct TCP / HTTP+WebSocket with Application-Layer AES-256-GCM |
| **Android Mobile <-> Android Mobile** | Local Wi-Fi / Hotspot | Direct TCP / HTTP with Application-Layer AES-256-GCM |

### Network Requirements:
- Both devices must be connected to the same local area network or mobile Wi-Fi hotspot.
- The Host device opens an ephemeral, loopback-guarded LAN listening port (default `8765`, dynamic fallback).
- Standard Windows Defender Firewall prompt may ask for LAN permission; no internet access or external port forwarding is ever requested.

---

## 3. Secure Pairing & Mutual Device Authentication

Pairing follows a short-lived, user-authenticated PAKE (Password Authenticated Key Exchange) model:

```
    [Device A: Host (Sender or Receiver)]             [Device B: Peer (Client)]
                 |                                                |
1. User clicks "Start Sync Session"                               |
   - Generates Ephemeral ECDH Keypair (P-256)                     |
   - Generates 6-Digit One-Time PIN                               |
   - Shows QR Code / PIN + Local IP:Port                          |
                 |                                                |
                 | <-------- 2. Connects with SessionId ----------|
                 |           & Ephemeral ECDH PublicKey (P-256)   |
                 |                                                |
3. User enters 6-Digit PIN on Device B                            |
   - Both devices derive Shared Master Secret (Z) via ECDH        |
   - Both devices compute SessionKey via HKDF-SHA256(Z, salt, PIN)|
   - SessionKey split into:                                       |
     * SessionEncKey (256-bit AES-GCM)                            |
     * SessionMacKey (256-bit HMAC-SHA256)                        |
                 |                                                |
4. Mutual Auth Handshake:                                         |
   - Exchange Auth Proof: HMAC-SHA256(SessionMacKey, "AUTH" + ID) |
   - Both verify proof. If invalid -> Immediate Abort & Lockout   |
                 | ---------------------------------------------> |
                 | <============================================> |
                 |          Secure Encrypted Channel Active       |
```

### Security Properties:
- **Replay Protection:** Every message contains a 64-bit monotonically increasing sequence number (`seqNum`) verified in authenticated associated data (AAD).
- **Session Expiration:** Pairing invitations expire automatically after **5 minutes** (`300 seconds`).
- **Brute-Force Resistance:** Maximum 3 incorrect PIN attempts before the session is destroyed and the ephemeral keys are wiped.
- **Device Identity & Revocation:** Each device possesses a persistent UUID (`deviceId`) and friendly name. Paired devices are stored in the local encrypted vault; revoking a device immediately invalidates its pairing credentials for all future sessions.

---

## 4. Logical Record Transfer & Schema Compatibility

Rather than copying binary SQLite files, sync operates on typed, normalized domain records:

### Domain Schema Sync Coverage:
1. `familyMembers`: Member definitions, relationships.
2. `assets`: General asset inventory.
3. `fds`: Fixed deposits, bank names, maturity schedules.
4. `postOffice`: Schemes (MIS, RD, PPF, SCSS, etc.).
5. `bullions`: Gold, silver, physical metals.
6. `properties`: Real estate holdings.
7. `rents`: Rental income and agreements (strictly segregated from realized totals).
8. `assetSales`: Liquidated asset sales records.
9. `payments`: Payment schedules and payment ledger.
10. `documents`: Document attachment metadata.
11. `contributions`: Scheduled SIP / RD contributions.

### Versioning & Schema Verification:
- All sync payloads carry `schemaVersion: 1`.
- If an older app connects to a newer app with an incompatible schema, sync halts with an explicit error: `"Incompatible schema version: received vX, expected vY. Please update FamilyVault."`

---

## 5. Conflict Detection & Duplicate Prevention

### Identification:
Entities are matched by their primary keys (`member_id`, `fd_id`, `a_id`, etc.).

### Comparison Logic:
For each incoming record:
1. **New Entity:** Primary key does not exist locally -> Staged as `INSERT`.
2. **Identical Entity:** Primary key exists and normalized JSON hash matches -> Marked as `IDENTICAL` (skipped, no write).
3. **Conflicting Entity:** Primary key exists but normalized field values or hashes differ -> Marked as `CONFLICT`.

### User-Controlled Conflict Resolution Policies:
- **`keep_local`:** Retains existing local records and skips incoming conflicting records.
- **`use_remote`:** Overwrites local conflicting records with incoming records.
- **`manual_review`:** Presents side-by-side diff in the UI and allows the user to choose per-item or per-table resolution before committing.
- **Golden Rule:** Financial records are **NEVER silently overwritten**.

---

## 6. Document Attachment Transfer Protocol

1. For each attachment in `documents`:
   - Sender reads the encrypted attachment ciphertext and computes its `sha256` content digest.
   - Encrypted attachment is streamed over the session-encrypted channel.
2. Receiver:
   - Verifies the received ciphertext against the sender's `sha256` digest.
   - Re-encrypts or stores the ciphertext directly into its internal encrypted attachment storage (`vault://attachments/*.enc`).
   - Rejects the entire transaction if any attachment checksum fails.

---

## 7. Transactional Safety & Pre-Sync Recovery Snapshot

```
[Start Sync Merge]
       │
       ▼
1. Create Pre-Sync Recovery Snapshot (Full Encrypted Backup)
       │
       ▼
2. Begin Database Transaction (BEGIN IMMEDIATE)
       │
       ├─► Apply Inserts
       ├─► Apply Resolved Conflicts
       ├─► Store Validated Attachments
       │
       ▼
3. Validation Checks:
   - Foreign key constraints (PRAGMA foreign_key_check)
   - Record counts and financial calculation integrity
       │
       ├─── All Valid? ───► YES ──► Commit Transaction (COMMIT)
       │                                     │
       │                                     ▼
       │                          Notify Sender: SUCCESS
       │
       └─── Any Error? ───► NO ───► Rollback Transaction (ROLLBACK)
                                             │
                                             ▼
                                  Clean Up Temporary Files
                                             │
                                             ▼
                                  Revert to Pre-Sync State
                                             │
                                             ▼
                                  Notify Sender: FAILED
```

---

## 8. Failure Modes & Recovery Summary

| Failure Scenario | System Response |
| :--- | :--- |
| **Network Dropped Mid-Transfer** | Receiver rolls back transaction; partial data deleted; pre-sync snapshot remains intact; sender shows "Connection interrupted". |
| **Incorrect Pairing PIN** | Session terminated; ephemeral keys wiped; lockout after 3 tries. |
| **Expired Pairing Session** | Connection refused with HTTP 408 / Session Expired; user prompted to generate new PIN. |
| **Tampered Ciphertext in Transit** | AES-256-GCM authentication tag mismatch throws SecurityException; transfer instantly aborted. |
| **Foreign Key Violation in Sync** | SQLite transaction rolled back; detailed error displayed; 0 corrupt records saved. |
| **Revoked Device Attempts Sync** | Host checks deviceId against local revocation list; handshake rejected with HTTP 403 Forbidden. |

---

## 9. Conclusion

This architecture provides military-grade security for local device-to-device synchronization while respecting FamilyVault's fundamental design: zero cloud storage, zero plaintext on the wire, no exposure of master passwords or database keys, and absolute preservation of existing financial data.
