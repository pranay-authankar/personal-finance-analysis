/**
 * FamilyVault Device-to-Device Sync Cryptographic Engine
 * Implements ephemeral P-256 ECDH, HKDF-SHA256, AES-256-GCM authenticated encryption,
 * sequence number replay protection, and HMAC-SHA256 mutual authentication proof.
 */

import * as nodeCrypto from 'node:crypto';

export interface KeyPair {
  ecdh: nodeCrypto.ECDH;
  publicKeyHex: string;
}

export interface SessionKeys {
  encKey: Buffer;
  macKey: Buffer;
}

export interface EncryptedPacket {
  seqNum: number;
  ivHex: string;
  ciphertextHex: string;
  tagHex: string;
}

export function generatePairingPin(): string {
  const buf = nodeCrypto.randomBytes(4);
  const num = buf.readUInt32BE(0) % 1000000;
  return num.toString().padStart(6, '0');
}

export function generateEphemeralKeyPair(): KeyPair {
  const ecdh = nodeCrypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const publicKeyHex = ecdh.getPublicKey('hex');
  return { ecdh, publicKeyHex };
}

export function deriveSessionKeys(
  ecdh: nodeCrypto.ECDH,
  peerPublicKeyHex: string,
  pin: string,
  sessionId: string
): SessionKeys {
  const peerKeyBuf = Buffer.from(peerPublicKeyHex, 'hex');
  const sharedSecret = ecdh.computeSecret(peerKeyBuf);

  const pinBuf = Buffer.from(pin, 'utf8');
  const ikm = Buffer.concat([sharedSecret, pinBuf]);
  const salt = Buffer.from(sessionId, 'utf8');
  const info = Buffer.from('FamilyVault-Sync-Session-v1', 'utf8');

  const derived = nodeCrypto.hkdfSync('sha256', ikm, salt, info, 64);
  const derivedBuf = Buffer.from(derived);

  const encKey = derivedBuf.subarray(0, 32);
  const macKey = derivedBuf.subarray(32, 64);

  return { encKey, macKey };
}

export function computeAuthProof(
  macKey: Buffer,
  rolePrefix: string,
  sessionId: string,
  publicKeyHex: string
): string {
  const hmac = nodeCrypto.createHmac('sha256', macKey);
  hmac.update(`${rolePrefix}:${sessionId}:${publicKeyHex}`);
  return hmac.digest('hex');
}

export function verifyAuthProof(
  macKey: Buffer,
  rolePrefix: string,
  sessionId: string,
  publicKeyHex: string,
  proofHex: string
): boolean {
  try {
    const expected = computeAuthProof(macKey, rolePrefix, sessionId, publicKeyHex);
    const expectedBuf = Buffer.from(expected, 'hex');
    const proofBuf = Buffer.from(proofHex, 'hex');
    if (expectedBuf.length !== proofBuf.length) return false;
    return nodeCrypto.timingSafeEqual(expectedBuf, proofBuf);
  } catch {
    return false;
  }
}

export function encryptPayload(data: unknown, encKey: Buffer, seqNum: number): EncryptedPacket {
  const plaintext = Buffer.from(typeof data === 'string' ? data : JSON.stringify(data), 'utf8');
  const iv = nodeCrypto.randomBytes(12);

  const cipher = nodeCrypto.createCipheriv('aes-256-gcm', encKey, iv);
  const aad = Buffer.alloc(8);
  aad.writeBigUInt64BE(BigInt(seqNum), 0);
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    seqNum,
    ivHex: iv.toString('hex'),
    ciphertextHex: ciphertext.toString('hex'),
    tagHex: tag.toString('hex')
  };
}

export function decryptPayload<T = unknown>(
  packet: EncryptedPacket,
  encKey: Buffer,
  expectedSeqNum?: number
): T {
  if (expectedSeqNum !== undefined && packet.seqNum !== expectedSeqNum) {
    throw new Error(
      `Replay or sequence error: expected packet seq ${expectedSeqNum}, got ${packet.seqNum}`
    );
  }

  const iv = Buffer.from(packet.ivHex, 'hex');
  const ciphertext = Buffer.from(packet.ciphertextHex, 'hex');
  const tag = Buffer.from(packet.tagHex, 'hex');

  const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', encKey, iv);
  const aad = Buffer.alloc(8);
  aad.writeBigUInt64BE(BigInt(packet.seqNum), 0);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const str = plaintext.toString('utf8');

  try {
    return JSON.parse(str) as T;
  } catch {
    return str as unknown as T;
  }
}

export function computeSha256(data: Buffer | string): string {
  const hash = nodeCrypto.createHash('sha256');
  if (typeof data === 'string') {
    hash.update(data, 'utf8');
  } else {
    hash.update(data);
  }
  return hash.digest('hex');
}
