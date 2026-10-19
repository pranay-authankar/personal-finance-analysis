package com.familyvault.app;

import android.content.ContentValues;
import android.content.Context;
import net.zetetic.database.sqlcipher.SQLiteDatabase;
import net.zetetic.database.sqlcipher.SQLiteCursor;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.*;

/**
 * VaultDatabaseHelper manages the encrypted SQLite database on Android using SQLCipher
 * with AES-256-CBC page-level encryption, relational schemas, foreign-key constraints,
 * and transactional record synchronization.
 */
public class VaultDatabaseHelper {

    static {
        try {
            System.loadLibrary("sqlcipher");
        } catch (Throwable t) {
            // In unit tests or platforms without native library, handle gracefully
        }
    }

    private final Context context;
    private final File dbFile;
    private SQLiteDatabase database = null;

    public VaultDatabaseHelper(Context context) {
        this(context, context != null ? new File(context.getFilesDir(), "vault") : new File(System.getProperty("java.io.tmpdir"), "vault_db_test_" + System.currentTimeMillis()));
    }

    public VaultDatabaseHelper(Context context, File vaultDir) {
        this.context = context;
        if (!vaultDir.exists()) {
            vaultDir.mkdirs();
        }
        this.dbFile = new File(vaultDir, "familyvault.fvault");
    }

    public File getDatabaseFile() {
        return dbFile;
    }

    public synchronized boolean isOpen() {
        return database != null && database.isOpen();
    }

    public synchronized SQLiteDatabase getDatabase() {
        if (!isOpen()) {
            throw new IllegalStateException("Database is not open or vault is locked.");
        }
        return database;
    }

    public synchronized void openDatabase(byte[] keyBytes) {
        if (isOpen()) {
            database.close();
        }

        // Open or create database with raw 256-bit key
        database = SQLiteDatabase.openOrCreateDatabase(dbFile, keyBytes, null, null);
        database.rawExecSQL("PRAGMA foreign_keys = ON;");
        database.rawExecSQL("PRAGMA journal_mode = WAL;");

        createSchema();
    }

    public synchronized void closeDatabase() {
        if (database != null) {
            try {
                if (database.isOpen()) {
                    database.close();
                }
            } catch (Exception ignored) {
            } finally {
                database = null;
            }
        }
    }

    private void createSchema() {
        database.beginTransaction();
        try {
            // 1. family_members
            database.execSQL("CREATE TABLE IF NOT EXISTS family_members (" +
                    "m_id TEXT PRIMARY KEY NOT NULL, " +
                    "m_name TEXT NOT NULL, " +
                    "relationship TEXT NOT NULL" +
                    ");");

            // 2. assets
            database.execSQL("CREATE TABLE IF NOT EXISTS assets (" +
                    "a_id TEXT PRIMARY KEY NOT NULL, " +
                    "a_name TEXT NOT NULL, " +
                    "a_type TEXT NOT NULL, " +
                    "location TEXT, " +
                    "notes TEXT, " +
                    "owner_id TEXT NOT NULL, " +
                    "FOREIGN KEY (owner_id) REFERENCES family_members(m_id) ON DELETE RESTRICT" +
                    ");");

            // 3. fds
            database.execSQL("CREATE TABLE IF NOT EXISTS fds (" +
                    "fd_id TEXT PRIMARY KEY NOT NULL, " +
                    "bank_name TEXT NOT NULL, " +
                    "fd_number TEXT, " +
                    "principal_amount REAL NOT NULL DEFAULT 0, " +
                    "interest_rate REAL NOT NULL DEFAULT 0, " +
                    "maturity_amount REAL NOT NULL DEFAULT 0, " +
                    "start_date TEXT NOT NULL, " +
                    "maturity_date TEXT NOT NULL, " +
                    "duration_months INTEGER, " +
                    "status TEXT NOT NULL DEFAULT 'ACTIVE', " +
                    "owner_id TEXT NOT NULL, " +
                    "FOREIGN KEY (owner_id) REFERENCES family_members(m_id) ON DELETE RESTRICT" +
                    ");");

            // 4. post_office
            database.execSQL("CREATE TABLE IF NOT EXISTS post_office (" +
                    "po_id TEXT PRIMARY KEY NOT NULL, " +
                    "account_number TEXT, " +
                    "scheme_type TEXT NOT NULL, " +
                    "deposit_amount REAL NOT NULL DEFAULT 0, " +
                    "interest_rate REAL NOT NULL DEFAULT 0, " +
                    "maturity_amount REAL NOT NULL DEFAULT 0, " +
                    "start_date TEXT NOT NULL, " +
                    "maturity_date TEXT NOT NULL, " +
                    "duration_months INTEGER, " +
                    "monthly_deposit REAL NOT NULL DEFAULT 0, " +
                    "status TEXT NOT NULL DEFAULT 'ACTIVE', " +
                    "owner_id TEXT NOT NULL, " +
                    "FOREIGN KEY (owner_id) REFERENCES family_members(m_id) ON DELETE RESTRICT" +
                    ");");

            // 5. bullions
            database.execSQL("CREATE TABLE IF NOT EXISTS bullions (" +
                    "b_id TEXT PRIMARY KEY NOT NULL, " +
                    "metal_type TEXT NOT NULL, " +
                    "item_name TEXT NOT NULL, " +
                    "weight_grams REAL NOT NULL DEFAULT 0, " +
                    "purity REAL NOT NULL DEFAULT 0, " +
                    "purchase_price REAL NOT NULL DEFAULT 0, " +
                    "purchase_date TEXT NOT NULL, " +
                    "current_value REAL, " +
                    "notes TEXT, " +
                    "owner_id TEXT NOT NULL, " +
                    "FOREIGN KEY (owner_id) REFERENCES family_members(m_id) ON DELETE RESTRICT" +
                    ");");

            // 6. properties
            database.execSQL("CREATE TABLE IF NOT EXISTS properties (" +
                    "prop_id TEXT PRIMARY KEY NOT NULL, " +
                    "prop_name TEXT NOT NULL, " +
                    "prop_type TEXT NOT NULL, " +
                    "purchase_price REAL NOT NULL DEFAULT 0, " +
                    "purchase_date TEXT NOT NULL, " +
                    "current_value REAL, " +
                    "address TEXT, " +
                    "notes TEXT, " +
                    "status TEXT NOT NULL DEFAULT 'ACTIVE', " +
                    "owner_id TEXT NOT NULL, " +
                    "FOREIGN KEY (owner_id) REFERENCES family_members(m_id) ON DELETE RESTRICT" +
                    ");");

            // 7. rents
            database.execSQL("CREATE TABLE IF NOT EXISTS rents (" +
                    "r_id TEXT PRIMARY KEY NOT NULL, " +
                    "prop_id TEXT NOT NULL, " +
                    "tenant_name TEXT NOT NULL, " +
                    "tenant_contact TEXT, " +
                    "monthly_rent REAL NOT NULL DEFAULT 0, " +
                    "rent_documents TEXT, " +
                    "rent_start_date TEXT, " +
                    "rent_end_date TEXT, " +
                    "FOREIGN KEY (prop_id) REFERENCES properties(prop_id) ON DELETE CASCADE" +
                    ");");

            // 8. asset_sales
            database.execSQL("CREATE TABLE IF NOT EXISTS asset_sales (" +
                    "s_id TEXT PRIMARY KEY NOT NULL, " +
                    "asset_type TEXT NOT NULL, " +
                    "asset_id TEXT NOT NULL, " +
                    "sale_amount REAL NOT NULL DEFAULT 0, " +
                    "sale_date TEXT NOT NULL, " +
                    "buyer_name TEXT, " +
                    "notes TEXT, " +
                    "owner_id TEXT NOT NULL, " +
                    "FOREIGN KEY (owner_id) REFERENCES family_members(m_id) ON DELETE RESTRICT" +
                    ");");

            // 9. payments
            database.execSQL("CREATE TABLE IF NOT EXISTS payments (" +
                    "pay_id TEXT PRIMARY KEY NOT NULL, " +
                    "payment_type TEXT NOT NULL, " +
                    "reference_id TEXT NOT NULL, " +
                    "amount REAL NOT NULL DEFAULT 0, " +
                    "due_date TEXT NOT NULL, " +
                    "status TEXT NOT NULL DEFAULT 'PENDING', " +
                    "payment_date TEXT, " +
                    "notes TEXT" +
                    ");");

            // 10. documents
            database.execSQL("CREATE TABLE IF NOT EXISTS documents (" +
                    "d_id TEXT PRIMARY KEY NOT NULL, " +
                    "d_name TEXT NOT NULL, " +
                    "d_type TEXT NOT NULL, " +
                    "d_link TEXT NOT NULL, " +
                    "upload_date TEXT NOT NULL, " +
                    "notes TEXT, " +
                    "owner_id TEXT NOT NULL, " +
                    "FOREIGN KEY (owner_id) REFERENCES family_members(m_id) ON DELETE RESTRICT" +
                    ");");

            // 11. contributions
            database.execSQL("CREATE TABLE IF NOT EXISTS contributions (" +
                    "c_id TEXT PRIMARY KEY NOT NULL, " +
                    "po_id TEXT NOT NULL, " +
                    "amount REAL NOT NULL DEFAULT 0, " +
                    "contribution_date TEXT, " +
                    "due_date TEXT NOT NULL, " +
                    "status TEXT NOT NULL DEFAULT 'PENDING', " +
                    "notes TEXT, " +
                    "FOREIGN KEY (po_id) REFERENCES post_office(po_id) ON DELETE CASCADE" +
                    ");");

            // 12. migration_ledger
            database.execSQL("CREATE TABLE IF NOT EXISTS migration_ledger (" +
                    "table_name TEXT PRIMARY KEY NOT NULL, " +
                    "source_format TEXT NOT NULL, " +
                    "migrated_at TEXT NOT NULL, " +
                    "records_migrated INTEGER NOT NULL, " +
                    "checksum TEXT NOT NULL" +
                    ");");

            // Indexes
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_assets_owner ON assets(owner_id);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_fds_owner ON fds(owner_id);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_fds_status ON fds(status);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_po_owner ON post_office(owner_id);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_po_status ON post_office(status);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_bullions_owner ON bullions(owner_id);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_rents_prop ON rents(prop_id);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_asset_sales_owner ON asset_sales(owner_id);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_asset_sales_type_id ON asset_sales(asset_type, asset_id);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_payments_ref ON payments(reference_id);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_payments_type_ref ON payments(payment_type, reference_id);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_payments_due_status ON payments(due_date, status);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(d_type);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_contributions_po ON contributions(po_id);");
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_contributions_due_status ON contributions(due_date, status);");

            database.setTransactionSuccessful();
        } finally {
            database.endTransaction();
        }
    }

    /**
     * Loads all records across all 11 tables and returns structured JSON for the frontend.
     */
    public synchronized JSONObject loadAll() throws Exception {
        if (!isOpen()) throw new IllegalStateException("Vault is locked.");

        JSONObject result = new JSONObject();
        result.put("familyMembers", queryTableToJson("family_members"));
        result.put("assets", queryTableToJson("assets"));
        result.put("fds", queryTableToJson("fds"));
        result.put("postOffice", queryTableToJson("post_office"));
        result.put("bullions", queryTableToJson("bullions"));
        result.put("properties", queryTableToJson("properties"));
        result.put("rents", queryTableToJson("rents"));
        result.put("assetSales", queryTableToJson("asset_sales"));
        result.put("payments", queryTableToJson("payments"));
        result.put("documents", queryTableToJson("documents"));
        result.put("contributions", queryTableToJson("contributions"));
        return result;
    }

    private JSONArray queryTableToJson(String tableName) throws Exception {
        JSONArray array = new JSONArray();
        try (android.database.Cursor cursor = database.rawQuery("SELECT * FROM " + tableName, null)) {
            String[] columnNames = cursor.getColumnNames();
            while (cursor.moveToNext()) {
                JSONObject row = new JSONObject();
                for (int i = 0; i < columnNames.length; i++) {
                    String col = columnNames[i];
                    if (cursor.isNull(i)) {
                        row.put(col, JSONObject.NULL);
                    } else {
                        switch (cursor.getType(i)) {
                            case android.database.Cursor.FIELD_TYPE_INTEGER:
                                row.put(col, cursor.getLong(i));
                                break;
                            case android.database.Cursor.FIELD_TYPE_FLOAT:
                                row.put(col, cursor.getDouble(i));
                                break;
                            case android.database.Cursor.FIELD_TYPE_STRING:
                            default:
                                row.put(col, cursor.getString(i));
                                break;
                        }
                    }
                }
                array.put(row);
            }
        }
        return array;
    }

    /**
     * Synchronizes a single table from the UI into the encrypted SQLite database transactionally.
     */
    public synchronized void saveTable(String tableNameInput, JSONArray records) throws Exception {
        if (!isOpen()) throw new IllegalStateException("Vault is locked.");

        String tableName = normalizeTableName(tableNameInput);
        String primaryKey = getPrimaryKeyForTable(tableName);

        database.beginTransaction();
        try {
            // Collect incoming IDs
            Set<String> incomingIds = new HashSet<>();
            for (int i = 0; i < records.length(); i++) {
                JSONObject obj = records.getJSONObject(i);
                if (obj.has(primaryKey) && !obj.isNull(primaryKey)) {
                    incomingIds.add(obj.getString(primaryKey));
                }
            }

            // Read existing IDs from database
            Set<String> existingIds = new HashSet<>();
            try (android.database.Cursor cursor = database.rawQuery("SELECT " + primaryKey + " FROM " + tableName, null)) {
                while (cursor.moveToNext()) {
                    existingIds.add(cursor.getString(0));
                }
            }

            // Delete records removed from UI
            for (String id : existingIds) {
                if (!incomingIds.contains(id)) {
                    database.delete(tableName, primaryKey + " = ?", new String[]{id});
                }
            }

            // Insert or replace current records
            for (int i = 0; i < records.length(); i++) {
                JSONObject obj = records.getJSONObject(i);
                ContentValues cv = new ContentValues();
                Iterator<String> keys = obj.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    Object val = obj.get(key);
                    if (val == null || val == JSONObject.NULL) {
                        cv.putNull(key);
                    } else if (val instanceof Number) {
                        cv.put(key, ((Number) val).doubleValue());
                    } else if (val instanceof Boolean) {
                        cv.put(key, ((Boolean) val) ? 1 : 0);
                    } else {
                        cv.put(key, val.toString());
                    }
                }
                database.insertWithOnConflict(tableName, null, cv, SQLiteDatabase.CONFLICT_REPLACE);
            }

            database.setTransactionSuccessful();
        } finally {
            database.endTransaction();
        }
    }

    /**
     * Clears all domain records inside an atomic transaction.
     */
    public synchronized void clearAll() throws Exception {
        if (!isOpen()) throw new IllegalStateException("Vault is locked.");

        database.beginTransaction();
        try {
            database.execSQL("DELETE FROM contributions;");
            database.execSQL("DELETE FROM payments;");
            database.execSQL("DELETE FROM rents;");
            database.execSQL("DELETE FROM asset_sales;");
            database.execSQL("DELETE FROM documents;");
            database.execSQL("DELETE FROM fds;");
            database.execSQL("DELETE FROM post_office;");
            database.execSQL("DELETE FROM bullions;");
            database.execSQL("DELETE FROM properties;");
            database.execSQL("DELETE FROM assets;");
            database.execSQL("DELETE FROM family_members;");
            database.setTransactionSuccessful();
        } finally {
            database.endTransaction();
        }
    }

    private String normalizeTableName(String name) {
        switch (name) {
            case "familyMembers": return "family_members";
            case "postOffice": return "post_office";
            case "assetSales": return "asset_sales";
            default: return name;
        }
    }

    private String getPrimaryKeyForTable(String table) {
        switch (table) {
            case "family_members": return "m_id";
            case "assets": return "a_id";
            case "fds": return "fd_id";
            case "post_office": return "po_id";
            case "bullions": return "b_id";
            case "properties": return "prop_id";
            case "rents": return "r_id";
            case "asset_sales": return "s_id";
            case "payments": return "pay_id";
            case "documents": return "d_id";
            case "contributions": return "c_id";
            case "migration_ledger": return "table_name";
            default: return "id";
        }
    }
}
