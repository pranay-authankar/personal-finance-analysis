package com.familyvault.app;

import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Iterator;

@CapacitorPlugin(name = "FamilyVaultNative")
public class VaultPlugin extends Plugin {

    private static final long INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000L; // 15 minutes

    private VaultSecurityManager securityManager;
    private VaultDatabaseHelper databaseHelper;
    private AttachmentManager attachmentManager;
    private BackupManager backupManager;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable autoLockRunnable = this::performAutoLock;

    @Override
    public void load() {
        super.load();
        this.securityManager = new VaultSecurityManager(getContext());
        this.databaseHelper = new VaultDatabaseHelper(getContext());
        this.attachmentManager = new AttachmentManager(getContext());
        this.backupManager = new BackupManager(getContext());
    }

    private synchronized void resetInactivityTimer() {
        handler.removeCallbacks(autoLockRunnable);
        if (securityManager != null && securityManager.isUnlocked()) {
            handler.postDelayed(autoLockRunnable, INACTIVITY_TIMEOUT_MS);
        }
    }

    private synchronized void performAutoLock() {
        if (securityManager != null && securityManager.isUnlocked()) {
            if (databaseHelper != null) {
                databaseHelper.closeDatabase();
            }
            securityManager.lockVault();
            notifyListeners("vaultLocked", new JSObject());
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        boolean isConfigured = securityManager.isConfigured();
        boolean isUnlocked = securityManager.isUnlocked();
        ret.put("isConfigured", isConfigured);
        ret.put("isUnlocked", isUnlocked);
        ret.put("vaultPath", databaseHelper.getDatabaseFile().getAbsolutePath());
        call.resolve(ret);
    }

    @PluginMethod
    public void createVault(PluginCall call) {
        String masterPassword = call.getString("masterPassword");
        if (masterPassword == null || masterPassword.length() < 8) {
            call.reject("Master password must be at least 8 characters long.");
            return;
        }

        try {
            byte[] mek = securityManager.setupVault(masterPassword);
            databaseHelper.openDatabase(mek);
            resetInactivityTimer();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to create encrypted vault: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void unlockVault(PluginCall call) {
        String masterPassword = call.getString("masterPassword");
        if (masterPassword == null) {
            call.reject("Master password is required.");
            return;
        }

        try {
            byte[] mek = securityManager.unlockVault(masterPassword);
            databaseHelper.openDatabase(mek);
            resetInactivityTimer();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (SecurityException se) {
            call.reject(se.getMessage());
        } catch (Exception e) {
            call.reject("Failed to unlock vault: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void lockVault(PluginCall call) {
        handler.removeCallbacks(autoLockRunnable);
        databaseHelper.closeDatabase();
        securityManager.lockVault();
        notifyListeners("vaultLocked", new JSObject());

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void loadAll(PluginCall call) {
        if (!securityManager.isUnlocked()) {
            call.reject("Vault is locked. Cannot read records.");
            return;
        }

        resetInactivityTimer();
        try {
            JSONObject json = databaseHelper.loadAll();
            JSObject ret = new JSObject();
            Iterator<String> keys = json.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                JSONArray arr = json.getJSONArray(key);
                ret.put(key, new JSArray(arr.toString()));
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to load records from vault: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void saveTable(PluginCall call) {
        if (!securityManager.isUnlocked()) {
            call.reject("Vault is locked. Cannot save records.");
            return;
        }

        String tableName = call.getString("tableName");
        JSArray recordsArray = call.getArray("records");
        if (tableName == null || recordsArray == null) {
            call.reject("Table name and records are required.");
            return;
        }

        resetInactivityTimer();
        try {
            JSONArray arr = new JSONArray(recordsArray.toString());
            databaseHelper.saveTable(tableName, arr);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to save table " + tableName + ": " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void clearAll(PluginCall call) {
        if (!securityManager.isUnlocked()) {
            call.reject("Vault is locked.");
            return;
        }

        resetInactivityTimer();
        try {
            databaseHelper.clearAll();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to clear vault records: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void uploadAttachment(PluginCall call) {
        if (!securityManager.isUnlocked()) {
            call.reject("Vault is locked.");
            return;
        }

        String originalFilename = call.getString("originalFilename", "document");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String dataBase64 = call.getString("dataBase64");

        if (dataBase64 == null) {
            call.reject("Attachment data is required.");
            return;
        }

        resetInactivityTimer();
        try {
            JSONObject res = attachmentManager.uploadAttachment(originalFilename, mimeType, dataBase64, securityManager.getActiveMek());
            JSObject ret = new JSObject();
            ret.put("d_link", res.getString("d_link"));
            ret.put("originalFilename", res.getString("originalFilename"));
            ret.put("mimeType", res.getString("mimeType"));
            ret.put("size", res.getInt("size"));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to upload attachment: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void readAttachment(PluginCall call) {
        if (!securityManager.isUnlocked()) {
            call.reject("Vault is locked.");
            return;
        }

        String attachmentPath = call.getString("attachmentPath");
        if (attachmentPath == null) {
            call.reject("Attachment path is required.");
            return;
        }

        resetInactivityTimer();
        try {
            JSONObject res = attachmentManager.readAttachment(attachmentPath, securityManager.getActiveMek());
            JSObject ret = new JSObject();
            ret.put("originalFilename", res.getString("originalFilename"));
            ret.put("mimeType", res.getString("mimeType"));
            ret.put("dataBase64", res.getString("dataBase64"));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to read attachment: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void deleteAttachment(PluginCall call) {
        String attachmentPath = call.getString("attachmentPath");
        if (attachmentPath == null) {
            call.reject("Attachment path is required.");
            return;
        }

        resetInactivityTimer();
        boolean deleted = attachmentManager.deleteAttachment(attachmentPath);
        JSObject ret = new JSObject();
        ret.put("success", deleted);
        call.resolve(ret);
    }

    @PluginMethod
    public void createBackup(PluginCall call) {
        if (!securityManager.isUnlocked()) {
            call.reject("Vault is locked.");
            return;
        }

        resetInactivityTimer();
        try {
            JSONObject res = backupManager.createBackup(databaseHelper, attachmentManager, securityManager.getActiveMek());
            JSObject ret = new JSObject();
            ret.put("backupPath", res.getString("backupPath"));
            ret.put("filename", res.getString("filename"));
            ret.put("size", res.getLong("size"));
            ret.put("timestamp", res.getString("timestamp"));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to create backup: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void restoreBackup(PluginCall call) {
        if (!securityManager.isUnlocked()) {
            call.reject("Vault is locked.");
            return;
        }

        String backupData = call.getString("backupData");
        if (backupData == null) {
            call.reject("Backup data is required.");
            return;
        }

        resetInactivityTimer();
        try {
            JSONObject res = backupManager.restoreBackup(backupData, databaseHelper, attachmentManager, securityManager.getActiveMek());
            JSObject ret = new JSObject();
            ret.put("success", res.getBoolean("success"));
            ret.put("restoredAt", res.getString("restoredAt"));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to restore backup: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void heartbeat(PluginCall call) {
        resetInactivityTimer();
        JSObject ret = new JSObject();
        ret.put("active", securityManager.isUnlocked());
        call.resolve(ret);
    }
}
