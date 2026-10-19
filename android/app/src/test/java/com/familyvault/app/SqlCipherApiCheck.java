package com.familyvault.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class SqlCipherApiCheck {
    @Test
    public void testSqlCipherClassAvailable() {
        try {
            Class<?> dbClass = Class.forName("net.zetetic.database.sqlcipher.SQLiteDatabase");
            assertNotNull(dbClass);
            System.out.println("SQLCipher SQLiteDatabase class successfully loaded: " + dbClass.getName());
        } catch (ClassNotFoundException e) {
            fail("SQLCipher class not found: " + e.getMessage());
        }
    }
}
