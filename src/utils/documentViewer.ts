/**
 * Resolves a document link to a displayable URL (decrypting in Electron if needed)
 * and opens or downloads it safely.
 */
export async function getDocumentDisplayUrl(link: string): Promise<string> {
  if (!link) return '';

  if (
    link.startsWith('data:') ||
    link.startsWith('blob:') ||
    link.startsWith('http://') ||
    link.startsWith('https://')
  ) {
    return link;
  }

  // If in Electron and document is encrypted
  if (
    typeof window !== 'undefined' &&
    window.vaultApi &&
    (link.startsWith('vault://') || link.endsWith('.enc'))
  ) {
    try {
      const res = await window.vaultApi.readAttachment(link);
      return res.dataUrl;
    } catch (err) {
      console.warn('Failed to decrypt attachment:', err);
      return '';
    }
  }

  return link;
}

/**
 * Opens a document safely in a new window or trigger viewer.
 */
export async function openDocumentViewer(link: string, title?: string): Promise<void> {
  const url = await getDocumentDisplayUrl(link);
  if (!url) {
    alert('Unable to load or decrypt document.');
    return;
  }

  if (url.startsWith('data:')) {
    const win = window.open('', '_blank');
    if (win) {
      win.document.title = title || 'FamilyVault Document';
      if (url.startsWith('data:application/pdf')) {
        win.document.write(
          `<!DOCTYPE html><html><head><title>${title || 'Document'}</title><style>html,body{margin:0;padding:0;height:100%;overflow:hidden;background:#1a1a1a;}</style></head><body><iframe src="${url}" width="100%" height="100%" style="border:none;"></iframe></body></html>`
        );
      } else {
        win.document.write(
          `<!DOCTYPE html><html><head><title>${title || 'Document'}</title><style>html,body{margin:0;padding:20px;height:100%;background:#111;display:flex;align-items:center;justify-content:center;}</style></head><body><img src="${url}" style="max-width:95%;max-height:95%;object-fit:contain;box-shadow:0 8px 24px rgba(0,0,0,0.5);border-radius:6px;"/></body></html>`
        );
      }
    }
  } else {
    window.open(url, '_blank');
  }
}
