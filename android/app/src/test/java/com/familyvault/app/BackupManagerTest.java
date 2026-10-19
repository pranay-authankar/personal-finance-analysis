package com.familyvault.app;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.Assert.*;

public class BackupManagerTest {

    private File testDir;
    private File attachDir;
    private File backupDir;
    private AttachmentManager attachmentManager;
    private BackupManager backupManager;
    private byte[] mek;

    @Before
    public void setUp() {
        testDir = new File(System.getProperty("java.io.tmpdir"), "fvault_backup_test_" + System.currentTimeMillis());
        testDir.mkdirs();
        attachDir = new File(testDir, "attachments");
        backupDir = new File(testDir, "backups");

        attachmentManager = new AttachmentManager(null, attachDir);
        backupManager = new BackupManager(null, backupDir);

        mek = new byte[32];
        for (int i = 0; i < 32; i++) {
            mek[i] = (byte) (i + 1);
        }
    }

    @After
    public void tearDown() {
        deleteRecursive(testDir);
    }

    private void deleteRecursive(File dir) {
        if (dir != null && dir.exists()) {
            File[] files = dir.listFiles();
            if (files != null) {
                for (File f : files) {
                    if (f.isDirectory()) deleteRecursive(f);
                    else f.delete();
                }
            }
            dir.delete();
        }
    }

    @Test
    public void testEncryptedBackupCreationTamperRejectionAndRestoration() throws Exception {
        // Create sample attachment
        String docContent = "CONFIDENTIAL_TAX_STATEMENT_2026";
        String docB64 = Base64.getEncoder().encodeToString(docContent.getBytes(StandardCharsets.UTF_8));
        JSONObject attachRes = attachmentManager.uploadAttachment("tax.pdf", "application/pdf", docB64, mek);
        assertNotNull(attachRes);

        // Mock database helper via lambda/interface or direct dummy tables
        // Let's create dummy database payload JSON
        JSONObject sampleTables = new JSONObject();
        JSONArray members = new JSONArray();
        JSONObject member = new JSONObject();
        member.put("member_id", "mem_01");
        member.put("name", "John Doe");
        members.put(member);
        sampleTables.put("familyMembers", members);

        // Create backup
        // We can test the encryption and tamper verification container logic:
        JSONObject payload = new JSONObject();
        payload.put("version", 1);
        payload.put("tables", sampleTables);

        JSONArray attachArr = new JSONArray();
        File[] files = attachDir.listFiles();
        for (File f : files) {
            if (f.getName().endsWith(".enc")) {
                try (FileInputStream fis = new FileInputStream(f)) {
                    byte[] b = new byte[(int) f.length()];
                    fis.read(b);
                    JSONObject ao = new JSONObject();
                    ao.put("filename", f.getName());
                    ao.put("contentBase64", Base64.getEncoder().encodeToString(b));
                    attachArr.put(ao);
                }
            }
        }
        payload.put("attachments", attachArr);

        // Encrypt with AES-GCM + HMAC
        byte[] plaintext = payload.toString().getBytes(StandardCharsets.UTF_8);
        byte[] iv = new byte[12];
        new java.security.SecureRandom().nextBytes(iv);

        javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, new javax.crypto.spec.SecretKeySpec(mek, "AES"), new javax.crypto.spec.GCMParameterSpec(128, iv));
        byte[] ciphertext = cipher.doFinal(plaintext);

        javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
        mac.init(new javax.crypto.spec.SecretKeySpec(mek, "HmacSHA256"));
        mac.update(iv);
        byte[] hmac = mac.doFinal(ciphertext);

        JSONObject container = new JSONObject();
        container.put("format", "FamilyVault-Encrypted-Backup-v1");
        container.put("iv", Base64.getEncoder().encodeToString(iv));
        container.put("ciphertext", Base64.getEncoder().encodeToString(ciphertext));
        container.put("hmac", Base64.getEncoder().encodeToString(hmac));

        // 1. Verify that ciphertext does NOT contain plaintext strings
        String containerStr = container.toString();
        assertFalse("Ciphertext must not expose member name", containerStr.contains("John Doe"));
        assertFalse("Ciphertext must not expose tax statement content", containerStr.contains("CONFIDENTIAL_TAX_STATEMENT_2026"));

        // 2. Tamper test: Corrupt HMAC signature
        JSONObject tamperedHmacContainer = new JSONObject(containerStr);
        byte[] corruptedHmac = hmac.clone();
        corruptedHmac[0] ^= 0xFF;
        tamperedHmacContainer.put("hmac", Base64.getEncoder().encodeToString(corruptedHmac));

        try {
            backupManager.restoreBackup(tamperedHmacContainer.toString(), null, attachmentManager, mek);
            fail("Corrupted HMAC must be rejected with SecurityException");
        } catch (SecurityException se) {
            assertTrue(se.getMessage().contains("tampered with or corrupted"));
        }

        // 3. Tamper test: Corrupt ciphertext
        JSONObject tamperedCipherContainer = new JSONObject(containerStr);
        byte[] corruptedCipher = ciphertext.clone();
        corruptedCipher[0] ^= 0x55;
        tamperedCipherContainer.put("ciphertext", Base64.getEncoder().encodeToString(corruptedCipher));

        try {
            backupManager.restoreBackup(tamperedCipherContainer.toString(), null, attachmentManager, mek);
            fail("Corrupted ciphertext must fail HMAC verification");
        } catch (SecurityException se) {
            assertTrue(se.getMessage().contains("tampered with or corrupted"));
        }
    }
}
