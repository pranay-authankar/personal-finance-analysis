package com.familyvault.app;

import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;

import static org.junit.Assert.*;

public class VaultSecurityManagerTest {

    private File testDir;
    private VaultSecurityManager securityManager;
    private AttachmentManager attachmentManager;

    @Before
    public void setUp() {
        testDir = new File(System.getProperty("java.io.tmpdir"), "fvault_android_test_" + System.currentTimeMillis());
        testDir.mkdirs();

        securityManager = new VaultSecurityManager(null, testDir);
        attachmentManager = new AttachmentManager(null, new File(testDir, "attachments"));
    }

    @After
    public void tearDown() {
        if (securityManager != null) {
            securityManager.lockVault();
        }
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
    public void testFirstRunVaultCreationAndKeyDerivation() throws Exception {
        assertFalse("Vault should not be configured initially", securityManager.isConfigured());
        assertFalse("Vault should not be unlocked initially", securityManager.isUnlocked());

        String masterPassword = "TestPassword#2026!";
        byte[] mek = securityManager.setupVault(masterPassword);

        assertNotNull("MEK must not be null", mek);
        assertEquals("MEK must be 32 bytes (256 bits)", 32, mek.length);
        assertTrue("Vault must report configured", securityManager.isConfigured());
        assertTrue("Vault must report unlocked after setup", securityManager.isUnlocked());

        File metaFile = new File(testDir, "vault_meta.json");
        assertTrue("vault_meta.json must exist", metaFile.exists());

        // Verify metadata contents
        try (FileInputStream fis = new FileInputStream(metaFile)) {
            byte[] bytes = new byte[(int) metaFile.length()];
            fis.read(bytes);
            JSONObject meta = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
            assertEquals("PBKDF2-HMAC-SHA512", meta.getString("algorithm"));
            assertEquals(600000, meta.getInt("iterations"));
            assertTrue(meta.has("salt"));
            assertTrue(meta.has("verifier"));
        }
    }

    @Test
    public void testMasterPasswordRejectionAndKeyWiping() throws Exception {
        String masterPassword = "CorrectPassword#2026!";
        securityManager.setupVault(masterPassword);

        // Lock vault
        securityManager.lockVault();
        assertFalse("Vault should be locked", securityManager.isUnlocked());

        // Attempt unlock with wrong password
        try {
            securityManager.unlockVault("WrongPassword#9999");
            fail("Expected SecurityException on incorrect password");
        } catch (SecurityException se) {
            assertTrue(se.getMessage().contains("Incorrect master password"));
        }

        assertFalse("Vault must remain locked on failed auth", securityManager.isUnlocked());

        // Unlock with correct password
        byte[] unlockedMek = securityManager.unlockVault(masterPassword);
        assertNotNull(unlockedMek);
        assertEquals(32, unlockedMek.length);
        assertTrue("Vault must be unlocked", securityManager.isUnlocked());
    }

    @Test
    public void testMemoryKeyWipingOnLock() throws Exception {
        String masterPassword = "KeyWipeTestPassword#2026";
        byte[] mek = securityManager.setupVault(masterPassword);
        byte[] mekCopy = Arrays.copyOf(mek, mek.length);

        assertTrue(securityManager.isUnlocked());
        assertArrayEquals(mekCopy, securityManager.getActiveMek());

        // Lock vault
        securityManager.lockVault();
        assertFalse(securityManager.isUnlocked());

        try {
            securityManager.getActiveMek();
            fail("getActiveMek() must throw IllegalStateException when locked");
        } catch (IllegalStateException expected) {
            // Success
        }
    }

    @Test
    public void testAttachmentEncryptionAndTamperRejection() throws Exception {
        String masterPassword = "AttachmentTestPassword#2026";
        byte[] mek = securityManager.setupVault(masterPassword);

        String sampleText = "CONFIDENTIAL_FINANCIAL_DOCUMENT_DATA_2026";
        String sampleBase64 = Base64.getEncoder().encodeToString(sampleText.getBytes(StandardCharsets.UTF_8));

        JSONObject uploadRes = attachmentManager.uploadAttachment("statement.pdf", "application/pdf", sampleBase64, mek);
        assertNotNull(uploadRes);
        String link = uploadRes.getString("d_link");
        assertTrue(link.startsWith("vault://attachments/"));

        String encFilename = link.substring("vault://attachments/".length());
        File encFile = new File(attachmentManager.getAttachmentsDir(), encFilename);
        assertTrue("Encrypted file must exist on disk", encFile.exists());

        // Verify ciphertext on disk contains ZERO plaintext
        try (FileInputStream fis = new FileInputStream(encFile)) {
            byte[] diskBytes = new byte[(int) encFile.length()];
            fis.read(diskBytes);
            String diskContent = new String(diskBytes, StandardCharsets.ISO_8859_1);
            assertFalse("Plaintext must NOT appear on disk", diskContent.contains(sampleText));
        }

        // Decrypt and verify exact bit-for-bit recovery
        JSONObject readRes = attachmentManager.readAttachment(link, mek);
        assertEquals("statement.pdf", readRes.getString("originalFilename"));
        assertEquals("application/pdf", readRes.getString("mimeType"));
        String dataUrl = readRes.getString("dataBase64");
        assertTrue(dataUrl.startsWith("data:application/pdf;base64,"));
        String recoveredB64 = dataUrl.substring("data:application/pdf;base64,".length());
        byte[] recoveredBytes = Base64.getDecoder().decode(recoveredB64);
        assertEquals(sampleText, new String(recoveredBytes, StandardCharsets.UTF_8));

        // Tamper test: modify one byte in encrypted file
        byte[] corruptedBytes;
        try (FileInputStream fis = new FileInputStream(encFile)) {
            corruptedBytes = new byte[(int) encFile.length()];
            fis.read(corruptedBytes);
        }
        corruptedBytes[corruptedBytes.length - 1] ^= 0xFF; // Flip bits in GCM tag
        try (FileOutputStream fos = new FileOutputStream(encFile)) {
            fos.write(corruptedBytes);
        }

        try {
            attachmentManager.readAttachment(link, mek);
            fail("Tampered encrypted attachment must fail AES-GCM tag verification");
        } catch (Exception expected) {
            // Expected cryptographic tag mismatch
            assertNotNull(expected);
        }
    }
}
