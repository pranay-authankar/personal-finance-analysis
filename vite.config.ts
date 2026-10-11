import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { handleAuthApi, isLoopbackRequest, isValidOriginAndHost } from './server/authManager.ts';
import { clearManagedUploads } from './server/storage/clearManager.ts';

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

        const urlPath = req.url ? req.url.split('?')[0] : '';

        // 2a. Clear managed upload files endpoint (/api/uploads/clear or /api/upload/clear)
        if (
          (urlPath === '/api/uploads/clear' ||
            urlPath === '/api/uploads/clear/' ||
            urlPath === '/api/upload/clear' ||
            urlPath === '/api/upload/clear/') &&
          req.method === 'POST'
        ) {
          if (!isLoopbackRequest(req) || !isValidOriginAndHost(req)) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Forbidden: Loopback and verified origin required' }));
            return;
          }

          const uploadsDir = path.resolve(process.cwd(), 'uploads');
          const clearResult = clearManagedUploads(uploadsDir, process.cwd());
          res.statusCode = clearResult.success ? 200 : 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(clearResult));
          return;
        }

        // 2b. Upload file endpoint (/api/upload)
        if ((urlPath === '/api/upload' || urlPath === '/api/upload/') && req.method === 'POST') {
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

        // 2c. Delete specific managed upload file endpoint (/api/uploads/delete)
        if (
          (urlPath === '/api/uploads/delete' ||
            urlPath === '/api/uploads/delete/' ||
            urlPath === '/api/upload/delete' ||
            urlPath === '/api/upload/delete/') &&
          req.method === 'POST'
        ) {
          if (!isLoopbackRequest(req) || !isValidOriginAndHost(req)) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Forbidden: Loopback and verified origin required' }));
            return;
          }

          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const fileUrl = typeof parsed.fileUrl === 'string' ? parsed.fileUrl : '';
              if (!fileUrl) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing fileUrl' }));
                return;
              }
              const relativePath = fileUrl.replace(/^\/?uploads\//, '').replace(/^[\\/]/, '');
              const uploadsDir = path.resolve(process.cwd(), 'uploads');
              const targetPath = path.resolve(uploadsDir, relativePath);

              // Guard: Ensure targetPath is strictly inside uploadsDir and exists
              if (
                targetPath.startsWith(uploadsDir + path.sep) &&
                fs.existsSync(targetPath) &&
                fs.statSync(targetPath).isFile()
              ) {
                fs.unlinkSync(targetPath);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, deleted: relativePath }));
                return;
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'File not found or already deleted' }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Failed to delete upload file' }));
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

function authApiPlugin(): Plugin {
  return {
    name: 'auth-api-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api/auth/')) {
          handleAuthApi(req, res, next);
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), csvStoragePlugin(), authApiPlugin()],
});
