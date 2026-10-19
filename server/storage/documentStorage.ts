import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getVaultAttachmentsDir } from '../config.ts';
import { deriveDocumentSubkey, encryptBlob, decryptBlob } from './crypto.ts';
import type { IEncryptedDocumentStorage, StoredDocumentMeta } from './types.ts';

const MAGIC_HEADER = Buffer.from('FVENC1', 'utf8'); // FamilyVault Encrypted Document v1

/**
 * Encrypted Document Attachment Storage implementation.
 * Guarantees zero plaintext leaks for uploaded PDFs, images, deeds, and receipts on disk.
 * Uses AES-256-GCM authenticated encryption with a dedicated HKDF-derived subkey.
 */
export class EncryptedDocumentStorage implements IEncryptedDocumentStorage {
  private attachmentsDir: string;

  constructor(attachmentsDir: string = getVaultAttachmentsDir()) {
    this.attachmentsDir = attachmentsDir;
  }

  private getDocFilePath(docId: string): string {
    // Sanitize docId to avoid path traversal
    const safeDocId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.attachmentsDir, `${safeDocId}.enc`);
  }

  /**
   * Stores an attachment encrypted with AES-256-GCM.
   */
  public async storeEncryptedDocument(
    docId: string,
    originalName: string,
    fileBuffer: Buffer,
    mek: Buffer,
    mimeType: string = 'application/octet-stream'
  ): Promise<StoredDocumentMeta> {
    fs.mkdirSync(this.attachmentsDir, { recursive: true });

    const docSubkey = deriveDocumentSubkey(mek);
    const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const envelope = JSON.stringify({
      docId,
      originalName,
      mimeType,
      sha256Hash,
      createdAt: new Date().toISOString(),
      contentBase64: fileBuffer.toString('base64')
    });

    const envelopeBuffer = Buffer.from(envelope, 'utf8');
    const { iv, authTag, ciphertext } = encryptBlob(envelopeBuffer, docSubkey);

    // Pack into file: [MAGIC_HEADER(6)][IV(12)][AUTH_TAG(16)][CIPHERTEXT]
    const packed = Buffer.concat([MAGIC_HEADER, iv, authTag, ciphertext]);
    const filePath = this.getDocFilePath(docId);
    fs.writeFileSync(filePath, packed);

    return {
      docId,
      originalName,
      storedFileName: path.basename(filePath),
      mimeType,
      fileSizeBytes: fileBuffer.length,
      encryptedSizeBytes: packed.length,
      sha256Hash,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Decrypts and retrieves a document attachment into memory.
   * Fails immediately if the file is modified or tampered with.
   */
  public async retrieveEncryptedDocument(
    docId: string,
    mek: Buffer
  ): Promise<{ originalName: string; mimeType: string; content: Buffer }> {
    const filePath = this.getDocFilePath(docId);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Encrypted document not found for ID: ${docId}`);
    }

    const packed = fs.readFileSync(filePath);
    if (packed.length < MAGIC_HEADER.length + 12 + 16) {
      throw new Error('Corrupted document file: header too short.');
    }

    // Verify magic header
    const header = packed.subarray(0, MAGIC_HEADER.length);
    if (!header.equals(MAGIC_HEADER)) {
      throw new Error('Invalid file format: missing FVENC1 header.');
    }

    let offset = MAGIC_HEADER.length;
    const iv = packed.subarray(offset, offset + 12);
    offset += 12;
    const authTag = packed.subarray(offset, offset + 16);
    offset += 16;
    const ciphertext = packed.subarray(offset);

    const docSubkey = deriveDocumentSubkey(mek);
    const decryptedJsonBuffer = decryptBlob(ciphertext, docSubkey, iv, authTag);
    const parsed = JSON.parse(decryptedJsonBuffer.toString('utf8')) as {
      originalName: string;
      mimeType: string;
      contentBase64: string;
    };

    return {
      originalName: parsed.originalName,
      mimeType: parsed.mimeType || 'application/octet-stream',
      content: Buffer.from(parsed.contentBase64, 'base64')
    };
  }

  /**
   * Securely removes an encrypted document file from storage.
   */
  public async deleteEncryptedDocument(docId: string): Promise<boolean> {
    const filePath = this.getDocFilePath(docId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  /**
   * Checks that the document file exists and can be successfully authenticated and decrypted.
   */
  public async verifyDocumentIntegrity(docId: string, mek: Buffer): Promise<boolean> {
    try {
      const doc = await this.retrieveEncryptedDocument(docId, mek);
      return doc.content.length > 0;
    } catch {
      return false;
    }
  }
}
