import {
  Connection,
  SurfaceCard,
  CardColor,
} from '../types/surface';
import {
  GoogleImportPlacement,
  GoogleOrganizeResult,
  GoogleThemeCluster,
  ImportedGoogleNote,
  noteToCardType,
} from '../types/googleImport';
import { generateGhostCardsForCard } from './cardIntelligence';

const CLUSTER_COLORS: CardColor[] = [
  'blue',
  'orange',
  'green',
  'purple',
  'yellow',
  'red',
  'gray',
];

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'have',
  'are', 'was', 'were', 'will', 'would', 'could', 'should', 'about', 'their',
  'them', 'they', 'then', 'than', 'when', 'what', 'which', 'while', 'where',
  'note', 'notes', 'keep', 'google', 'untitled', 'a', 'an', 'of', 'to', 'in',
  'on', 'at', 'by', 'or', 'as', 'is', 'it', 'be', 'not', 'but', 'can',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function noteBag(note: ImportedGoogleNote): string {
  const list = note.listItems?.map((i) => i.text).join(' ') || '';
  return `${note.title} ${note.content} ${note.labels.join(' ')} ${list}`;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function pickClusterName(notes: ImportedGoogleNote[], keywords: string[]): string {
  if (keywords.length > 0) {
    return keywords
      .slice(0, 3)
      .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
      .join(' · ');
  }
  const labelCounts = new Map<string, number>();
  for (const note of notes) {
    for (const label of note.labels) {
      labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
    }
  }
  const topLabel = [...labelCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topLabel) return topLabel;
  return notes[0]?.title.slice(0, 36) || 'Theme cluster';
}

/**
 * Local heuristic organizer used when Gemini is unavailable.
 * Groups by shared labels/keywords and scores pairwise overlaps.
 */
export function organizeNotesLocally(notes: ImportedGoogleNote[]): GoogleOrganizeResult {
  if (notes.length === 0) {
    return {
      overview: 'No Google notes were imported yet.',
      clusters: [],
      connections: [],
      highlights: [],
      suggestedQuestions: [
        'Import a Google Keep Takeout ZIP or JSON export to begin.',
      ],
    };
  }

  const tokenSets = notes.map((n) => new Set(tokenize(noteBag(n))));
  const assigned = new Set<number>();
  const clusters: GoogleThemeCluster[] = [];

  // Prefer labels that appear on multiple notes so themes coalesce
  const byLabel = new Map<string, number[]>();
  notes.forEach((note, idx) => {
    const labels = note.labels.length > 0 ? note.labels : ['general'];
    for (const label of labels) {
      const key = label.toLowerCase();
      if (!byLabel.has(key)) byLabel.set(key, []);
      byLabel.get(key)!.push(idx);
    }
  });

  const rankedLabels = [...byLabel.entries()].sort((a, b) => {
    // Prefer multi-member labels, then larger groups
    const multiA = a[1].length > 1 ? 1 : 0;
    const multiB = b[1].length > 1 ? 1 : 0;
    if (multiB !== multiA) return multiB - multiA;
    return b[1].length - a[1].length;
  });

  let colorIdx = 0;
  for (const [label, idxs] of rankedLabels) {
    const uniqueIdxs = [...new Set(idxs)].filter((i) => !assigned.has(i));
    // Skip singleton labels if a multi-label theme already covers most notes
    if (uniqueIdxs.length === 0) continue;
    if (uniqueIdxs.length === 1 && idxs.length === 1 && assigned.size < notes.length) {
      // defer true singletons until after multi-member labels
      continue;
    }

    const members = uniqueIdxs.map((i) => notes[i]);
    const keywordFreq = new Map<string, number>();
    for (const i of uniqueIdxs) {
      for (const t of tokenSets[i]) {
        keywordFreq.set(t, (keywordFreq.get(t) || 0) + 1);
      }
    }
    const keywords = [...keywordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);

    clusters.push({
      id: `cluster-${label}-${clusters.length}`,
      name: label.charAt(0).toUpperCase() + label.slice(1),
      summary: `${members.length} notes tagged “${label}”. Themes: ${keywords.slice(0, 3).join(', ') || 'general'}.`,
      noteIds: members.map((m) => m.id),
      color: CLUSTER_COLORS[colorIdx++ % CLUSTER_COLORS.length],
      keywords,
    });
    uniqueIdxs.forEach((i) => assigned.add(i));
  }

  // Remaining unassigned notes → keyword clustering / singleton labels
  for (let i = 0; i < notes.length; i++) {
    if (assigned.has(i)) continue;
    const group = [i];
    assigned.add(i);
    for (let j = i + 1; j < notes.length; j++) {
      if (assigned.has(j)) continue;
      if (jaccard(tokenSets[i], tokenSets[j]) >= 0.12) {
        group.push(j);
        assigned.add(j);
      }
    }
    const members = group.map((gi) => notes[gi]);
    const keywordFreq = new Map<string, number>();
    for (const gi of group) {
      for (const t of tokenSets[gi]) {
        keywordFreq.set(t, (keywordFreq.get(t) || 0) + 1);
      }
    }
    const keywords = [...keywordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);

    clusters.push({
      id: `cluster-kw-${clusters.length}`,
      name: pickClusterName(members, keywords),
      summary: `Auto-clustered ${members.length} related notes around ${keywords.slice(0, 3).join(', ') || 'shared themes'}.`,
      noteIds: members.map((m) => m.id),
      color: CLUSTER_COLORS[colorIdx++ % CLUSTER_COLORS.length],
      keywords,
    });
  }

  // Pairwise connections across notes with meaningful overlap
  const connections: GoogleOrganizeResult['connections'] = [];
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const score = jaccard(tokenSets[i], tokenSets[j]);
      const sharedLabels = notes[i].labels.filter((l) =>
        notes[j].labels.map((x) => x.toLowerCase()).includes(l.toLowerCase())
      );
      const sharedTokens = [...tokenSets[i]].filter((t) => tokenSets[j].has(t)).slice(0, 4);
      // Soften threshold for small corpora so chat still has edges to explore
      const minConfidence = notes.length <= 8 ? 0.08 : 0.15;
      const confidence = Math.min(
        0.95,
        score + (sharedLabels.length > 0 ? 0.28 : 0) + (sharedTokens.length >= 2 ? 0.1 : 0)
      );
      if (
        confidence < minConfidence &&
        sharedTokens.length === 0 &&
        sharedLabels.length === 0
      ) {
        continue;
      }

      connections.push({
        fromNoteId: notes[i].id,
        toNoteId: notes[j].id,
        label: sharedLabels[0] || sharedTokens[0] || 'related',
        reasoning:
          sharedLabels.length > 0
            ? `Share label(s): ${sharedLabels.join(', ')}`
            : `Overlap on: ${sharedTokens.join(', ') || 'theme'}`,
        confidence: Math.max(confidence, sharedTokens.length > 0 || sharedLabels.length > 0 ? 0.2 : confidence),
      });
    }
  }

  connections.sort((a, b) => b.confidence - a.confidence);
  const topConnections = connections.slice(0, Math.min(12, connections.length));

  const pinned = notes.filter((n) => n.isPinned).map((n) => n.title);
  const highlights = [
    ...pinned.map((t) => `Pinned: ${t}`),
    ...clusters.slice(0, 3).map((c) => `${c.name}: ${c.noteIds.length} notes`),
  ].slice(0, 6);

  const overview = [
    `Imported ${notes.length} Google note${notes.length === 1 ? '' : 's'} into ${clusters.length} thematic cluster${clusters.length === 1 ? '' : 's'}.`,
    clusters.length > 0
      ? `Dominant themes: ${clusters.slice(0, 3).map((c) => c.name).join(', ')}.`
      : '',
    topConnections.length > 0
      ? `Detected ${topConnections.length} cross-note connection${topConnections.length === 1 ? '' : 's'} worth exploring in chat.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    overview,
    clusters,
    connections: topConnections,
    highlights,
    suggestedQuestions: [
      'What are the main themes across my Google notes?',
      'Which notes contradict each other?',
      'Summarize the product and AI related notes together.',
      'What decisions are still open?',
    ],
  };
}

function formatNoteContent(note: ImportedGoogleNote): string {
  const parts: string[] = [];
  if (note.content) parts.push(note.content);
  if (note.listItems && note.listItems.length > 0) {
    parts.push(
      note.listItems
        .map((item) => `${item.isChecked ? '☑' : '☐'} ${item.text}`)
        .join('\n')
    );
  }
  if (note.sourceUrl) parts.push(`Source: ${note.sourceUrl}`);
  parts.push(`_Imported from Google ${note.source.toUpperCase()}_`);
  return parts.join('\n\n');
}

/**
 * Place organized Google notes onto the spatial canvas as sections + cards + edges.
 */
export function placeOrganizedNotesOnCanvas(
  notes: ImportedGoogleNote[],
  organization: GoogleOrganizeResult,
  originX: number,
  originY: number
): GoogleImportPlacement {
  const now = Date.now();
  const cards: SurfaceCard[] = [];
  const connections: Connection[] = [];
  const noteIdToCardId = new Map<string, string>();
  const clusterSectionIds: string[] = [];

  // Overview / synthesis card
  const overviewId = `card-goverview-${now}`;
  const overviewCard: SurfaceCard = {
    id: overviewId,
    type: 'concept',
    title: 'Google Notes — Intelligence Overview',
    content: [
      organization.overview,
      '',
      '### Highlights',
      ...organization.highlights.map((h) => `• ${h}`),
      '',
      '### Ask the copilot',
      ...organization.suggestedQuestions.map((q) => `• ${q}`),
    ].join('\n'),
    x: originX,
    y: originY,
    width: 360,
    height: 280,
    color: 'orange',
    tags: ['GOOGLE', 'OVERVIEW', 'AI'],
    pinned: true,
    createdAt: now,
    updatedAt: now,
  };
  overviewCard.ghostCards = generateGhostCardsForCard(overviewCard);
  cards.push(overviewCard);

  const clusterGapX = 620;
  const clusterGapY = 520;

  organization.clusters.forEach((cluster, cIdx) => {
    const col = cIdx % 2;
    const row = Math.floor(cIdx / 2);
    const sectionX = originX + 420 + col * clusterGapX;
    const sectionY = originY + row * clusterGapY;
    const memberNotes = notes.filter((n) => cluster.noteIds.includes(n.id));
    const cols = Math.min(2, Math.max(1, memberNotes.length));
    const rows = Math.ceil(memberNotes.length / cols) || 1;
    const sectionId = `sec-gcluster-${cIdx}-${now}`;
    clusterSectionIds.push(sectionId);

    const section: SurfaceCard = {
      id: sectionId,
      type: 'section',
      title: cluster.name,
      content: cluster.summary,
      x: sectionX,
      y: sectionY,
      width: cols * 280 + 60,
      height: rows * 210 + 90,
      color: cluster.color,
      tags: ['GOOGLE', 'CLUSTER', ...cluster.keywords.slice(0, 3).map((k) => k.toUpperCase())],
      createdAt: now,
      updatedAt: now,
    };
    cards.push(section);

    // Link overview → cluster
    connections.push({
      id: `conn-overview-${sectionId}`,
      fromId: overviewId,
      toId: sectionId,
      label: 'theme',
      style: 'dashed',
      semanticType: 'theme_cluster',
      confidence: 0.8,
      reasoning: cluster.summary,
    });

    memberNotes.forEach((note, nIdx) => {
      const ncol = nIdx % cols;
      const nrow = Math.floor(nIdx / cols);
      const cardId = `card-gnote-${note.id}`;
      noteIdToCardId.set(note.id, cardId);

      const card: SurfaceCard = {
        id: cardId,
        type: noteToCardType(note),
        title: note.title,
        content: formatNoteContent(note),
        x: sectionX + 28 + ncol * 280,
        y: sectionY + 58 + nrow * 210,
        width: 260,
        height: 190,
        color: (note.color as CardColor) || cluster.color,
        tags: [
          'GOOGLE',
          note.source.toUpperCase(),
          ...note.labels.map((l) => l.toUpperCase()).slice(0, 4),
          ...(note.isPinned ? ['PINNED'] : []),
        ],
        pinned: note.isPinned,
        sectionId,
        attribution: {
          source: `Google ${note.source}`,
        },
        createdAt: note.createdAt || now,
        updatedAt: note.updatedAt || now,
      };
      card.ghostCards = generateGhostCardsForCard(card);
      cards.push(card);
    });
  });

  // Orphan notes not covered by clusters
  const covered = new Set(organization.clusters.flatMap((c) => c.noteIds));
  const orphans = notes.filter((n) => !covered.has(n.id));
  orphans.forEach((note, idx) => {
    const cardId = `card-gnote-${note.id}`;
    noteIdToCardId.set(note.id, cardId);
    const card: SurfaceCard = {
      id: cardId,
      type: noteToCardType(note),
      title: note.title,
      content: formatNoteContent(note),
      x: originX + (idx % 3) * 280,
      y: originY + 340 + Math.floor(idx / 3) * 210,
      width: 260,
      height: 190,
      color: (note.color as CardColor) || 'default',
      tags: ['GOOGLE', note.source.toUpperCase(), ...note.labels.map((l) => l.toUpperCase())],
      createdAt: note.createdAt || now,
      updatedAt: note.updatedAt || now,
      attribution: { source: `Google ${note.source}` },
    };
    card.ghostCards = generateGhostCardsForCard(card);
    cards.push(card);
    connections.push({
      id: `conn-orphan-${cardId}`,
      fromId: overviewId,
      toId: cardId,
      label: 'imported',
      style: 'dashed',
    });
  });

  // Semantic connections between notes
  for (const suggestion of organization.connections) {
    const fromId = noteIdToCardId.get(suggestion.fromNoteId);
    const toId = noteIdToCardId.get(suggestion.toNoteId);
    if (!fromId || !toId) continue;
    connections.push({
      id: `conn-g-${fromId}-${toId}`,
      fromId,
      toId,
      label: suggestion.label,
      style: 'solid',
      semanticType: 'google_affinity',
      confidence: suggestion.confidence,
      reasoning: suggestion.reasoning,
      strength: suggestion.confidence,
    });
  }

  return {
    cards,
    connections,
    overviewCardId: overviewId,
    clusterSectionIds,
  };
}
