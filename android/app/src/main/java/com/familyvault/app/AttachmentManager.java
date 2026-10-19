package com.familyvault.app;

import android.content.Context;
import java.util.Base64;
import org.json.JSONObject;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.UUID;

/**
 * AttachmentManager handles AES-256-GCM encryption and decryption of document attachments
 * stored strictly in private internal storage.
 */
public class AttachmentManager {
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;

    private final Context context;
    private final File attachmentsDir;

    public AttachmentManager(Context context) {
        this(context, context != null ? new File(new File(context.getFilesDir(), "vault"), "attachments") : new File(System.getProperty("java.io.tmpdir"), "vault_attach_test_" + System.currentTimeMillis()));
    }

    public AttachmentManager(Context context, File attachmentsDir) {
        this.context = context;
        this.attachmentsDir = attachmentsDir;
        if (!this.attachmentsDir.exists()) {
            this.attachmentsDir.mkdirs();
        }
    }

    public File getAttachmentsDir() {
        return attachmentsDir;
    }

    /**
     * Encrypts and writes document attachment to internal storage.
     * Returns virtual path 'vault://attachments/<id>.enc'
     */
    public synchronized JSONObject uploadAttachment(String originalFilename, String mimeType, String dataBase64, byte[] mek) throws Exception {
        if (mek == null || mek.length != 32) {
            throw new IllegalStateException("Vault is locked. Encryption key unavailable.");
        }

        // Handle data URL prefix if present (e.g. data:image/png;base64,....)
        String rawBase64 = dataBase64;
        String detectedMime = mimeType != null ? mimeType : "application/octet-stream";
        if (dataBase64 != null && dataBase64.startsWith("data:")) {
            int commaIdx = dataBase64.indexOf(',');
            if (commaIdx != -1) {
                String metaPart = dataBase64.substring(5, commaIdx);
                int semiIdx = metaPart.indexOf(';');
                if (semiIdx != -1) {
                    detectedMime = metaPart.substring(0, semiIdx);
                }
                rawBase64 = dataBase64.substring(commaIdx + 1);
            }
        }

        byte[] plaintext = Base64.getDecoder().decode(rawBase64);

        // Pack metadata header into payload: JSON length (4 bytes) + JSON header + raw binary
        JSONObject header = new JSONObject();
        header.put("originalFilename", originalFilename != null ? originalFilename : "document");
        header.put("mimeType", detectedMime);
        header.put("fileSize", plaintext.length);
        byte[] headerBytes = header.toString().getBytes(StandardCharsets.UTF_8);

        byte[] payload = new byte[4 + headerBytes.length + plaintext.length];
        payload[0] = (byte) ((headerBytes.length >> 24) & 0xFF);
        payload[1] = (byte) ((headerBytes.length >> 16) & 0xFF);
        payload[2] = (byte) ((headerBytes.length >> 8) & 0xFF);
        payload[3] = (byte) (headerBytes.length & 0xFF);
        System.arraycopy(headerBytes, 0, payload, 4, headerBytes.length);
        System.arraycopy(plaintext, 0, payload, 4 + headerBytes.length, plaintext.length);

        // Encrypt via AES-256-GCM with fresh 12-byte IV
        byte[] iv = new byte[GCM_IV_LENGTH];
        new SecureRandom().nextBytes(iv);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        SecretKeySpec keySpec = new SecretKeySpec(mek, "AES");
        GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec);
        byte[] ciphertext = cipher.doFinal(payload);

        // Write IV + Ciphertext to disk
        String fileId = UUID.randomUUID().toString();
        String safeName = fileId + ".enc";
        File encFile = new File(attachmentsDir, safeName);

        try (FileOutputStream fos = new FileOutputStream(encFile)) {
            fos.write(iv);
            fos.write(ciphertext);
        }

        JSONObject result = new JSONObject();
        result.put("d_link", "vault://attachments/" + safeName);
        result.put("originalFilename", originalFilename);
        result.put("mimeType", detectedMime);
        result.put("size", plaintext.length);
        return result;
    }

    /**
     * Reads and decrypts document attachment in memory.
     */
    public synchronized JSONObject readAttachment(String attachmentPath, byte[] mek) throws Exception {
        if (mek == null || mek.length != 32) {
            throw new IllegalStateException("Vault is locked. Encryption key unavailable.");
        }

        String filename = attachmentPath;
        if (filename.startsWith("vault://attachments/")) {
            filename = filename.substring("vault://attachments/".length());
        } else if (filename.startsWith("/uploads/")) {
            filename = filename.substring("/uploads/".length());
        }

        File encFile = new File(attachmentsDir, filename);
        if (!encFile.exists()) {
            throw new IllegalArgumentException("Attachment file not found: " + filename);
        }

        byte[] fileBytes;
        try (FileInputStream fis = new FileInputStream(encFile)) {
            fileBytes = new byte[(int) encFile.length()];
            fis.read(fileBytes);
        }

        if (fileBytes.length < GCM_IV_LENGTH + 16) {
            throw new IllegalStateException("Corrupt encrypted attachment file: too short.");
        }

        byte[] iv = new byte[GCM_IV_LENGTH];
        System.arraycopy(fileBytes, 0, iv, 0, GCM_IV_LENGTH);

        int cipherLen = fileBytes.length - GCM_IV_LENGTH;
        byte[] ciphertext = new byte[cipherLen];
        System.arraycopy(fileBytes, GCM_IV_LENGTH, ciphertext, 0, cipherLen);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        SecretKeySpec keySpec = new SecretKeySpec(mek, "AES");
        GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec);
        byte[] decryptedPayload = cipher.doFinal(ciphertext);

        // Parse header length
        int headerLen = ((decryptedPayload[0] & 0xFF) << 24) |
                ((decryptedPayload[1] & 0xFF) << 16) |
                ((decryptedPayload[2] & 0xFF) << 8) |
                (decryptedPayload[3] & 0xFF);

        String headerStr = new String(decryptedPayload, 4, headerLen, StandardCharsets.UTF_8);
        JSONObject header = new JSONObject(headerStr);

        int fileDataOffset = 4 + headerLen;
        int fileDataLen = decryptedPayload.length - fileDataOffset;
        byte[] fileData = new byte[fileDataLen];
        System.arraycopy(decryptedPayload, fileDataOffset, fileData, 0, fileDataLen);

        String b64 = Base64.getEncoder().encodeToString(fileData);
        String mime = header.optString("mimeType", "application/octet-stream");
        String dataUrl = "data:" + mime + ";base64," + b64;

        JSONObject result = new JSONObject();
        result.put("originalFilename", header.optString("originalFilename", filename));
        result.put("mimeType", mime);
        result.put("dataBase64", dataUrl);
        return result;
    }

    public synchronized boolean deleteAttachment(String attachmentPath) {
        String filename = attachmentPath;
        if (filename.startsWith("vault://attachments/")) {
            filename = filename.substring("vault://attachments/".length());
        }
        File file = new File(attachmentsDir, filename);
        if (file.exists()) {
            return file.delete();
        }
        return false;
    }
}
