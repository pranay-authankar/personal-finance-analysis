import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

function csvStoragePlugin(): Plugin {
  return {
    name: 'csv-storage-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // 1. Uploads static file serving (/uploads/*)
        if (req.url && req.url.startsWith('/uploads/')) {
          const relativeFilePath = req.url.replace('/uploads/', '').split('?')[0];
          const localFilePath = path.resolve(process.cwd(), 'uploads', relativeFilePath);

          if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
            const ext = path.extname(localFilePath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.webp': 'image/webp',
              '.gif': 'image/gif',
              '.pdf': 'application/pdf',
              '.svg': 'image/svg+xml'
            };
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            fs.createReadStream(localFilePath).pipe(res);
            return;
          } else {
            res.statusCode = 404;
            res.end('File not found');
            return;
          }
        }

        // 2. Upload file endpoint (/api/upload)
        if (req.url && req.url.startsWith('/api/upload') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const uploadsDir = path.resolve(process.cwd(), 'uploads');
              fs.mkdirSync(uploadsDir, { recursive: true });

              const parsed = JSON.parse(body);
              const originalName = (parsed.filename || 'document.png').replace(/[^a-zA-Z0-9.-]/g, '_');
              const filename = `${Date.now()}_${originalName}`;
              const targetPath = path.join(uploadsDir, filename);

              // Extract base64 payload if data URL
              let base64Data = parsed.data || '';
              if (base64Data.includes(';base64,')) {
                base64Data = base64Data.split(';base64,')[1];
              }

              fs.writeFileSync(targetPath, Buffer.from(base64Data, 'base64'));

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, fileUrl: `/uploads/${filename}` }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Failed to upload document file' }));
            }
          });
          return;
        }

        // 3. Single authoritative CSV API (/api/csv/* backed solely by data/*.csv)
        if (req.url && req.url.startsWith('/api/csv/')) {
          let tableName = req.url.replace('/api/csv/', '').split('?')[0];
          if (tableName === 'property_payments') {
            tableName = 'payments';
          }
          const allowedTables = [
            'family_members',
            'assets',
            'fds',
            'post_office',
            'bullions',
            'properties',
            'rents',
            'asset_sales',
            'payments',
            'documents',
            'contributions'
          ];
          if (!allowedTables.includes(tableName)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid table name' }));
            return;
          }

          // Single authoritative path in data/
          const primaryPath = path.resolve(process.cwd(), 'data', `${tableName}.csv`);

          if (req.method === 'GET') {
            if (fs.existsSync(primaryPath)) {
              const content = fs.readFileSync(primaryPath, 'utf-8');
              res.setHeader('Content-Type', 'text/csv; charset=utf-8');
              res.end(content);
            } else {
              res.statusCode = 404;
              res.end('');
            }
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              let textToSave = body;
              if (body.trim().startsWith('{')) {
                try {
                  const parsed = JSON.parse(body);
                  if (typeof parsed.csvContent === 'string') {
                    textToSave = parsed.csvContent;
                  }
                } catch {
                  // use raw body
                }
              }
              fs.mkdirSync(path.dirname(primaryPath), { recursive: true });
              fs.writeFileSync(primaryPath, textToSave, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, table: tableName }));
            });
            return;
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), csvStoragePlugin()],
});
