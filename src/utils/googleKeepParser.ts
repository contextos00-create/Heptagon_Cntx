import JSZip from 'jszip';
import {
  GoogleKeepLabel,
  GoogleKeepListItem,
  ImportedGoogleNote,
  keepColorToCardColor,
} from '../types/googleImport';

/** Raw shape of a Google Keep Takeout JSON note */
interface KeepTakeoutRaw {
  color?: string;
  isArchived?: boolean;
  isPinned?: boolean;
  isTrashed?: boolean;
  textContent?: string;
  title?: string;
  userEditedTimestampUsec?: number;
  createdTimestampUsec?: number;
  labels?: GoogleKeepLabel[];
  listContent?: Array<{ text?: string; isChecked?: boolean }>;
  attachments?: Array<{ filePath?: string; mimetype?: string }>;
  annotations?: Array<{ title?: string; description?: string; url?: string }>;
}

function usecToMs(usec?: number): number | undefined {
  if (!usec || !Number.isFinite(usec)) return undefined;
  return Math.floor(usec / 1000);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function makeNoteId(seed: string, index: number): string {
  const slug = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return `gkeep-${slug || 'note'}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

export function parseKeepJsonObject(
  raw: KeepTakeoutRaw,
  index: number,
  fileName?: string
): ImportedGoogleNote | null {
  if (raw.isTrashed) return null;

  const listItems: GoogleKeepListItem[] | undefined = raw.listContent
    ?.filter((item) => item.text && item.text.trim())
    .map((item) => ({
      text: item.text!.trim(),
      isChecked: Boolean(item.isChecked),
    }));

  const annotationText =
    raw.annotations
      ?.map((a) => [a.title, a.description, a.url].filter(Boolean).join(' — '))
      .filter(Boolean)
      .join('\n') || '';

  const listText =
    listItems
      ?.map((item) => `${item.isChecked ? '[x]' : '[ ]'} ${item.text}`)
      .join('\n') || '';

  const bodyParts = [raw.textContent || '', listText, annotationText]
    .map((p) => p.trim())
    .filter(Boolean);

  const title =
    (raw.title && raw.title.trim()) ||
    (fileName ? fileName.replace(/\.(json|html?)$/i, '') : '') ||
    bodyParts[0]?.slice(0, 48) ||
    `Untitled Keep note ${index + 1}`;

  const content = bodyParts.join('\n\n').trim();
  if (!content && !title) return null;

  const labels = (raw.labels || [])
    .map((l) => l.name)
    .filter((name): name is string => Boolean(name && name.trim()));

  return {
    id: makeNoteId(title, index),
    source: 'keep',
    title,
    content: content || title,
    labels,
    color: keepColorToCardColor(raw.color),
    isPinned: raw.isPinned,
    isArchived: raw.isArchived,
    listItems,
    attachments: raw.attachments,
    createdAt: usecToMs(raw.createdTimestampUsec),
    updatedAt: usecToMs(raw.userEditedTimestampUsec) || Date.now(),
  };
}

export function parseKeepJsonText(
  text: string,
  fileName?: string
): ImportedGoogleNote[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }

  const notes: ImportedGoogleNote[] = [];

  if (Array.isArray(parsed)) {
    parsed.forEach((item, idx) => {
      if (item && typeof item === 'object') {
        const note = parseKeepJsonObject(item as KeepTakeoutRaw, idx, fileName);
        if (note) notes.push(note);
      }
    });
    return notes;
  }

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    // Some Takeout dumps wrap notes under a key
    if (Array.isArray(obj.notes)) {
      (obj.notes as KeepTakeoutRaw[]).forEach((item, idx) => {
        const note = parseKeepJsonObject(item, idx, fileName);
        if (note) notes.push(note);
      });
      return notes;
    }
    const single = parseKeepJsonObject(obj as KeepTakeoutRaw, 0, fileName);
    if (single) notes.push(single);
  }

  return notes;
}

export function parseKeepHtmlText(
  html: string,
  fileName?: string,
  index = 0
): ImportedGoogleNote | null {
  const titleMatch =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ||
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)</i);

  const titleFromFile = fileName
    ? fileName.replace(/\.(html?)$/i, '').replace(/_/g, ' ')
    : undefined;
  const title = stripHtml(titleMatch?.[1] || titleFromFile || `Keep note ${index + 1}`);

  // Prefer content regions commonly used in Keep HTML exports
  const contentMatch =
    html.match(/class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)(?:<\/div>|$)/i) ||
    html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  const content = stripHtml(contentMatch?.[1] || html);
  if (!content && !title) return null;

  const labelMatches = [...html.matchAll(/class=["'][^"']*label[^"']*["'][^>]*>([\s\S]*?)</gi)];
  const labels = labelMatches
    .map((m) => stripHtml(m[1]))
    .filter((l) => l.length > 0 && l.length < 40);

  return {
    id: makeNoteId(title, index),
    source: 'keep',
    title,
    content: content || title,
    labels: [...new Set(labels)],
    updatedAt: Date.now(),
  };
}

export async function parseTakeoutZip(file: File): Promise<ImportedGoogleNote[]> {
  const zip = await JSZip.loadAsync(file);
  const notes: ImportedGoogleNote[] = [];
  let index = 0;

  const entries = Object.values(zip.files).filter(
    (entry) =>
      !entry.dir &&
      (/keep/i.test(entry.name) ||
        /\.json$/i.test(entry.name) ||
        /\.html?$/i.test(entry.name))
  );

  for (const entry of entries) {
    // Skip non-note Takeout paths when possible
    const lower = entry.name.toLowerCase();
    if (
      lower.includes('takeout/') &&
      !lower.includes('/keep/') &&
      !lower.includes('keep/')
    ) {
      // Allow loose Keep JSON at root of zip
      if (!/(^|\/)keep\//i.test(entry.name) && !/notes\.json$/i.test(entry.name)) {
        continue;
      }
    }

    const text = await entry.async('text');
    const baseName = entry.name.split('/').pop() || entry.name;

    if (/\.json$/i.test(entry.name)) {
      const parsed = parseKeepJsonText(text, baseName);
      parsed.forEach((n) => {
        notes.push({ ...n, id: makeNoteId(n.title, index++) });
      });
    } else if (/\.html?$/i.test(entry.name)) {
      const note = parseKeepHtmlText(text, baseName, index);
      if (note) {
        notes.push(note);
        index += 1;
      }
    }
  }

  return dedupeNotes(notes);
}

export async function parseGoogleImportFiles(
  files: File[]
): Promise<ImportedGoogleNote[]> {
  const notes: ImportedGoogleNote[] = [];
  let index = 0;

  for (const file of files) {
    const name = file.name.toLowerCase();

    if (name.endsWith('.zip')) {
      const fromZip = await parseTakeoutZip(file);
      fromZip.forEach((n) => {
        notes.push({ ...n, id: makeNoteId(n.title, index++) });
      });
      continue;
    }

    const text = await file.text();

    if (name.endsWith('.json')) {
      parseKeepJsonText(text, file.name).forEach((n) => {
        notes.push({ ...n, id: makeNoteId(n.title, index++) });
      });
      continue;
    }

    if (name.endsWith('.html') || name.endsWith('.htm')) {
      const note = parseKeepHtmlText(text, file.name, index);
      if (note) {
        notes.push(note);
        index += 1;
      }
      continue;
    }

    if (name.endsWith('.md') || name.endsWith('.txt')) {
      const title = file.name.replace(/\.(md|txt)$/i, '');
      notes.push({
        id: makeNoteId(title, index++),
        source: 'manual',
        title,
        content: text,
        labels: ['IMPORTED'],
        updatedAt: file.lastModified || Date.now(),
      });
    }
  }

  return dedupeNotes(notes);
}

function dedupeNotes(notes: ImportedGoogleNote[]): ImportedGoogleNote[] {
  const seen = new Set<string>();
  const result: ImportedGoogleNote[] = [];
  for (const note of notes) {
    const key = `${note.title.trim().toLowerCase()}::${note.content.slice(0, 120).trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(note);
  }
  return result;
}

/** Sample Keep notes for offline demos when no export is available */
export function createSampleGoogleNotes(): ImportedGoogleNote[] {
  const now = Date.now();
  return [
    {
      id: 'gkeep-sample-product',
      source: 'keep',
      title: 'Product thesis — spatial notes',
      content:
        'People do not think in folders. They think in clusters of related ideas. A whiteboard that imports Keep notes should rebuild those clusters automatically and surface surprising links between product decisions and research insights.',
      labels: ['product', 'heptasurface', 'research'],
      color: 'blue',
      isPinned: true,
      updatedAt: now - 86400000 * 3,
    },
    {
      id: 'gkeep-sample-ai',
      source: 'keep',
      title: 'AI copilot requirements',
      content:
        'Copilot must: (1) summarize a board of Keep notes, (2) propose thematic clusters, (3) draw edges between notes that share entities or goals, (4) answer chat with auto-zoom to source cards about product decisions.',
      labels: ['ai', 'copilot', 'product'],
      color: 'purple',
      listItems: [
        { text: 'Summarize imported notes', isChecked: true },
        { text: 'Cluster by theme', isChecked: true },
        { text: 'Suggest connections', isChecked: false },
        { text: 'Chat with citations', isChecked: false },
      ],
      updatedAt: now - 86400000 * 2,
    },
    {
      id: 'gkeep-sample-research',
      source: 'keep',
      title: 'Interview insight — knowledge workers',
      content:
        'Users dump thoughts into Keep during meetings, then never revisit them. The value is retrieval + synthesis, not storage. Connecting meeting notes to product decisions and AI copilots would be huge.',
      labels: ['research', 'users', 'product'],
      color: 'orange',
      updatedAt: now - 86400000,
    },
    {
      id: 'gkeep-sample-decision',
      source: 'docs',
      title: 'Decision: Start with Takeout import',
      content:
        'Google Keep has no public consumer API. Ship Takeout JSON/HTML/ZIP import first. Add Drive Docs OAuth as an optional second source when GOOGLE_CLIENT_ID is configured. This unblocks the AI organize and chat workflow.',
      labels: ['decision', 'integration', 'product'],
      color: 'green',
      sourceUrl: 'https://takeout.google.com',
      updatedAt: now - 3600000,
    },
    {
      id: 'gkeep-sample-habits',
      source: 'keep',
      title: 'Weekly review checklist',
      content: 'Scan new Keep notes → cluster themes with AI → write one overview → ask copilot what product decisions conflict with research.',
      labels: ['habits', 'workflow', 'ai'],
      listItems: [
        { text: 'Import new notes', isChecked: false },
        { text: 'Run AI organize', isChecked: false },
        { text: 'Chat about contradictions', isChecked: false },
      ],
      updatedAt: now,
    },
  ];
}
