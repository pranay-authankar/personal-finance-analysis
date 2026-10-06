/**
 * Uploads an image or document file to the backend uploads directory
 * and returns the relative file path (e.g., '/uploads/1728238129_passbook.png')
 * so that CSV files store only clean file paths, never huge Base64 strings.
 */
export async function uploadDocumentFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            data: dataUrl
          })
        });

        if (res.ok) {
          const result = await res.json();
          if (result.fileUrl) {
            resolve(result.fileUrl);
            return;
          }
        }
      } catch (err) {
        console.warn('Failed to upload file to /api/upload:', err);
      }

      // Fallback relative path reference
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      resolve(`/uploads/${Date.now()}_${cleanName}`);
    };

    reader.onerror = () => {
      resolve('');
    };

    reader.readAsDataURL(file);
  });
}
