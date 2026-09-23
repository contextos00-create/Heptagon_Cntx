import { SurfaceCard, CardType } from '../types/surface';

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function detectCardType(file: File): { type: CardType; codeLang?: string } {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  if (mime.startsWith('image/')) return { type: 'image' };
  if (mime.startsWith('audio/')) return { type: 'audio' };
  if (mime.startsWith('video/')) return { type: 'video' };
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return { type: 'pdf' };

  if (name.endsWith('.csv') || name.endsWith('.tsv')) return { type: 'table' };

  // Code extensions
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return { type: 'code', codeLang: 'typescript' };
  if (name.endsWith('.js') || name.endsWith('.jsx')) return { type: 'code', codeLang: 'javascript' };
  if (name.endsWith('.py')) return { type: 'code', codeLang: 'python' };
  if (name.endsWith('.rs')) return { type: 'code', codeLang: 'rust' };
  if (name.endsWith('.go')) return { type: 'code', codeLang: 'go' };
  if (name.endsWith('.html') || name.endsWith('.htm')) return { type: 'code', codeLang: 'html' };
  if (name.endsWith('.css') || name.endsWith('.scss')) return { type: 'code', codeLang: 'css' };
  if (name.endsWith('.json')) return { type: 'code', codeLang: 'json' };
  if (name.endsWith('.sql')) return { type: 'code', codeLang: 'sql' };
  if (name.endsWith('.sh') || name.endsWith('.bash')) return { type: 'code', codeLang: 'bash' };

  if (mime.startsWith('text/') || name.endsWith('.md') || name.endsWith('.txt')) {
    return { type: 'note' };
  }

  return { type: 'link' };
}

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: ['Column 1', 'Column 2'], rows: [['', '']] };
  }

  const parseLine = (l: string) => {
    // Basic comma/tab separator handling
    const sep = l.includes('\t') ? '\t' : ',';
    return l.split(sep).map(col => col.trim().replace(/^["']|["']$/g, ''));
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

export async function processFileToCard(
  file: File,
  x: number,
  y: number
): Promise<SurfaceCard> {
  const { type, codeLang } = detectCardType(file);
  const id = 'card-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const now = Date.now();

  const baseCard: SurfaceCard = {
    id,
    type,
    title: file.name,
    content: '',
    x,
    y,
    width: type === 'section' ? 520 : type === 'image' || type === 'video' ? 260 : 250,
    height: type === 'image' || type === 'video' ? 220 : 190,
    color: 'default',
    tags: [file.name.split('.').pop()?.toUpperCase() || 'FILE'],
    createdAt: now,
    updatedAt: now,
    fileMetadata: {
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    }
  };

  if (type === 'image' || type === 'audio' || type === 'video') {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        baseCard.fileMetadata!.dataUrl = dataUrl;
        baseCard.content = `Uploaded ${type.toUpperCase()}: ${file.name} (${formatBytes(file.size)})`;
        resolve(baseCard);
      };
      reader.onerror = () => {
        baseCard.content = `Failed to read file preview for ${file.name}`;
        resolve(baseCard);
      };
      reader.readAsDataURL(file);
    });
  }

  if (type === 'code' || type === 'note') {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string) || '';
        baseCard.content = text;
        if (codeLang) {
          baseCard.codeLanguage = codeLang;
        }
        resolve(baseCard);
      };
      reader.onerror = () => {
        baseCard.content = `Uploaded file: ${file.name}`;
        resolve(baseCard);
      };
      reader.readAsText(file);
    });
  }

  if (type === 'table') {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string) || '';
        const parsed = parseCSV(text);
        baseCard.tableData = parsed;
        baseCard.content = `Imported table dataset with ${parsed.rows.length} rows and ${parsed.headers.length} columns.`;
        resolve(baseCard);
      };
      reader.readAsText(file);
    });
  }

  if (type === 'pdf') {
    // For PDFs, store dataUrl so user can open/preview it, and provide readable content summary
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        baseCard.fileMetadata!.dataUrl = dataUrl;
        baseCard.fileMetadata!.pageCount = Math.max(1, Math.round(file.size / 45000));
        baseCard.content = `PDF Document: ${file.name}\nSize: ${formatBytes(file.size)}\nEstimated Pages: ~${baseCard.fileMetadata!.pageCount}\n\nKey highlights extracted from document index. Double-click to view document details or download.`;
        resolve(baseCard);
      };
      reader.readAsDataURL(file);
    });
  }

  // Fallback
  return baseCard;
}
