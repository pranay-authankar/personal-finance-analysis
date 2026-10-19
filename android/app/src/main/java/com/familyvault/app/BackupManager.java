package com.familyvault.app;

import android.content.Context;
import java.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * BackupManager handles creating and restoring AES-256-GCM encrypted, HMAC-SHA256 verified
 * vault backup containers.
 */
public class BackupManager {
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;

    private final Context context;
    private final File backupsDir;

    public BackupManager(Context context) {
        this(context, context != null ? new File(new File(context.getFilesDir(), "vault"), "backups") : new File(System.getProperty("java.io.tmpdir"), "vault_backup_test_" + System.currentTimeMillis()));
    }

    public BackupManager(Context context, File backupsDir) {
        this.context = context;
        this.backupsDir = backupsDir;
        if (!this.backupsDir.exists()) {
            this.backupsDir.mkdirs();
        }
    }

    public File getBackupsDir() {
        return backupsDir;
    }

    public synchronized JSONObject createBackup(VaultDatabaseHelper dbHelper, AttachmentManager attachMgr, byte[] mek) throws Exception {
        if (mek == null || mek.length != 32) {
            throw new IllegalStateException("Vault is locked. Encryption key unavailable.");
        }

        JSONObject allData = dbHelper.loadAll();

        // Include attachments
        JSONArray attachmentsArray = new JSONArray();
        File attachDir = attachMgr.getAttachmentsDir();
        File[] files = attachDir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isFile() && file.getName().endsWith(".enc")) {
                    try (FileInputStream fis = new FileInputStream(file)) {
                        byte[] bytes = new byte[(int) file.length()];
                        fis.read(bytes);
                        JSONObject attachObj = new JSONObject();
                        attachObj.put("filename", file.getName());
                        attachObj.put("contentBase64", Base64.getEncoder().encodeToString(bytes));
                        attachmentsArray.put(attachObj);
                    }
                }
            }
        }

        JSONObject payloadJson = new JSONObject();
        payloadJson.put("version", 1);
        payloadJson.put("exportedAt", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(new Date()));
        payloadJson.put("tables", allData);
        payloadJson.put("attachments", attachmentsArray);

        byte[] plaintext = payloadJson.toString().getBytes(StandardCharsets.UTF_8);

        // Encrypt with AES-256-GCM
        byte[] iv = new byte[GCM_IV_LENGTH];
        new SecureRandom().nextBytes(iv);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        SecretKeySpec keySpec = new SecretKeySpec(mek, "AES");
        GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec);
        byte[] ciphertext = cipher.doFinal(plaintext);

        // Compute HMAC-SHA256 over IV + Ciphertext
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec hmacSpec = new SecretKeySpec(mek, "HmacSHA256");
        mac.init(hmacSpec);
        mac.update(iv);
        byte[] hmac = mac.doFinal(ciphertext);

        JSONObject container = new JSONObject();
        container.put("format", "FamilyVault-Encrypted-Backup-v1");
        container.put("iv", Base64.getEncoder().encodeToString(iv));
        container.put("ciphertext", Base64.getEncoder().encodeToString(ciphertext));
        container.put("hmac", Base64.getEncoder().encodeToString(hmac));

        String dateStr = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
        String backupFilename = "FamilyVault_Backup_" + dateStr + ".fvaultbak";
        File backupFile = new File(backupsDir, backupFilename);

        try (FileOutputStream fos = new FileOutputStream(backupFile)) {
            fos.write(container.toString(2).getBytes(StandardCharsets.UTF_8));
        }

        JSONObject result = new JSONObject();
        result.put("backupPath", backupFile.getAbsolutePath());
        result.put("filename", backupFilename);
        result.put("size", backupFile.length());
        result.put("timestamp", payloadJson.getString("exportedAt"));
        return result;
    }

    public synchronized JSONObject restoreBackup(String containerJsonStr, VaultDatabaseHelper dbHelper, AttachmentManager attachMgr, byte[] mek) throws Exception {
        if (mek == null || mek.length != 32) {
            throw new IllegalStateException("Vault is locked. Encryption key unavailable.");
        }

        JSONObject container = new JSONObject(containerJsonStr);
        if (!"FamilyVault-Encrypted-Backup-v1".equals(container.optString("format"))) {
            throw new IllegalArgumentException("Invalid backup format. Expected FamilyVault-Encrypted-Backup-v1");
        }

        byte[] iv = Base64.getDecoder().decode(container.getString("iv"));
        byte[] ciphertext = Base64.getDecoder().decode(container.getString("ciphertext"));
        byte[] expectedHmac = Base64.getDecoder().decode(container.getString("hmac"));

        // Verify HMAC-SHA256
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec hmacSpec = new SecretKeySpec(mek, "HmacSHA256");
        mac.init(hmacSpec);
        mac.update(iv);
        byte[] actualHmac = mac.doFinal(ciphertext);

        if (!MessageDigestEquals(expectedHmac, actualHmac)) {
            throw new SecurityException("Cryptographic verification failed: Backup file has been tampered with or corrupted.");
        }

        // Decrypt AES-256-GCM
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        SecretKeySpec keySpec = new SecretKeySpec(mek, "AES");
        GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec);
        byte[] plaintext = cipher.doFinal(ciphertext);

        JSONObject payload = new JSONObject(new String(plaintext, StandardCharsets.UTF_8));
        JSONObject tables = payload.getJSONObject("tables");

        // Clear existing tables and import inside database
        dbHelper.clearAll();

        String[] tableOrder = {
                "familyMembers", "assets", "fds", "postOffice", "bullions",
                "properties", "rents", "assetSales", "payments", "documents", "contributions"
        };

        for (String table : tableOrder) {
            if (tables.has(table)) {
                dbHelper.saveTable(table, tables.getJSONArray(table));
            }
        }

        // Restore attachments
        if (payload.has("attachments")) {
            JSONArray attachments = payload.getJSONArray("attachments");
            File attachDir = attachMgr.getAttachmentsDir();
            for (int i = 0; i < attachments.length(); i++) {
                JSONObject item = attachments.getJSONObject(i);
                String filename = item.getString("filename");
                byte[] data = Base64.getDecoder().decode(item.getString("contentBase64"));
                File file = new File(attachDir, filename);
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(data);
                }
            }
        }

        JSONObject result = new JSONObject();
        result.put("success", true);
        result.put("restoredAt", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(new Date()));
        return result;
    }

    private static boolean MessageDigestEquals(byte[] a, byte[] b) {
        if (a == null || b == null) return false;
        if (a.length != b.length) return false;
        int result = 0;
        for (int i = 0; i < a.length; i++) {
            result |= a[i] ^ b[i];
        }
        return result == 0;
    }
}
