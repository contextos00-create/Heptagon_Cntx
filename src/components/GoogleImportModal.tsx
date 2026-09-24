import React, { useMemo, useRef, useState } from 'react';
import {
  X,
  Cloud,
  FileUp,
  Sparkles,
  Link2,
  Loader2,
  CheckCircle2,
  StickyNote,
  HardDrive,
  ExternalLink,
} from 'lucide-react';
import { Badge, ActionIcon, Button, Progress, Textarea, Tabs } from '@mantine/core';
import {
  GoogleOrganizeResult,
  ImportedGoogleNote,
} from '../types/googleImport';
import {
  createSampleGoogleNotes,
  parseGoogleImportFiles,
} from '../utils/googleKeepParser';
import { organizeNotesLocally } from '../utils/googleNotesOrganizer';

export interface GoogleImportCommitPayload {
  notes: ImportedGoogleNote[];
  organization: GoogleOrganizeResult;
  createNewBoard: boolean;
  boardName: string;
}

interface GoogleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommit: (payload: GoogleImportCommitPayload) => void;
  driveConfigured?: boolean;
  keepEnvConfigured?: boolean;
  keepSessionEmail?: string | null;
}

type Step = 'source' | 'preview' | 'organize';

export const GoogleImportModal: React.FC<GoogleImportModalProps> = ({
  isOpen,
  onClose,
  onCommit,
  driveConfigured = false,
  keepEnvConfigured = false,
  keepSessionEmail = null,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<Step>('source');
  const [notes, setNotes] = useState<ImportedGoogleNote[]>([]);
  const [organization, setOrganization] = useState<GoogleOrganizeResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [isKeepSyncing, setIsKeepSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [createNewBoard, setCreateNewBoard] = useState(true);
  const [boardName, setBoardName] = useState('Google Notes Surface');
  const [activeTab, setActiveTab] = useState<string | null>('keep');
  const [pastedText, setPastedText] = useState('');
  const [keepEmail, setKeepEmail] = useState(keepSessionEmail || '');
  const [keepMasterToken, setKeepMasterToken] = useState('');
  const [keepPassword, setKeepPassword] = useState('');
  const [keepIncludeArchived, setKeepIncludeArchived] = useState(false);
  const [keepHint, setKeepHint] = useState<string | null>(null);

  const reset = () => {
    setStep('source');
    setNotes([]);
    setOrganization(null);
    setIsParsing(false);
    setIsOrganizing(false);
    setIsKeepSyncing(false);
    setError(null);
    setPastedText('');
    setKeepPassword('');
    setKeepHint(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const ingestNotes = (incoming: ImportedGoogleNote[]) => {
    if (incoming.length === 0) {
      setError('No notes found in that export. Try Keep Takeout JSON, HTML, or ZIP.');
      return;
    }
    setNotes(incoming);
    setBoardName(`Google Notes (${incoming.length})`);
    setStep('preview');
    setError(null);
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsParsing(true);
    setError(null);
    try {
      const parsed = await parseGoogleImportFiles(Array.from(fileList));
      ingestNotes(parsed);
    } catch (err: any) {
      setError(err?.message || 'Failed to parse Google export');
    } finally {
      setIsParsing(false);
    }
  };

  const handlePasteImport = () => {
    const chunks = pastedText
      .split(/\n{2,}|(?=^#{1,3}\s)/m)
      .map((c) => c.trim())
      .filter(Boolean);
    if (chunks.length === 0) {
      setError('Paste at least one note (separate notes with a blank line).');
      return;
    }
    const now = Date.now();
    const parsed: ImportedGoogleNote[] = chunks.map((chunk, idx) => {
      const lines = chunk.split('\n');
      const title = lines[0].replace(/^#+\s*/, '').slice(0, 80) || `Pasted note ${idx + 1}`;
      const content = lines.slice(1).join('\n').trim() || chunk;
      return {
        id: `gpaste-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        source: 'manual',
        title,
        content,
        labels: ['PASTED'],
        updatedAt: now,
      };
    });
    ingestNotes(parsed);
  };

  const handleLoadSample = () => {
    ingestNotes(createSampleGoogleNotes());
  };

  const handleKeepLiveSync = async (opts?: { useEnv?: boolean }) => {
    setIsKeepSyncing(true);
    setError(null);
    setKeepHint(null);
    try {
      const response = await fetch('/api/google/keep/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: keepEmail.trim() || undefined,
          master_token: keepMasterToken.trim() || undefined,
          password: keepPassword.trim() || undefined,
          include_archived: keepIncludeArchived,
          use_env: Boolean(opts?.useEnv),
          max_notes: 200,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Keep sync failed');
        if (data.hint) setKeepHint(data.hint);
        return;
      }
      if (data.warning) setKeepHint(data.warning);
      if (data.masterTokenHint) setKeepHint(data.masterTokenHint);
      setKeepPassword('');
      ingestNotes((data.notes || []) as ImportedGoogleNote[]);
    } catch (err: any) {
      setError(err?.message || 'Keep sync failed');
      setKeepHint('Install bridge deps: pip install -r requirements.txt');
    } finally {
      setIsKeepSyncing(false);
    }
  };

  const runOrganize = async () => {
    if (notes.length === 0) return;
    setIsOrganizing(true);
    setError(null);
    setStep('organize');
    try {
      const response = await fetch('/api/google/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (response.ok) {
        const data = await response.json();
        setOrganization(data as GoogleOrganizeResult);
      } else {
        setOrganization(organizeNotesLocally(notes));
      }
    } catch {
      setOrganization(organizeNotesLocally(notes));
    } finally {
      setIsOrganizing(false);
    }
  };

  const labelSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes) {
      for (const label of note.labels) {
        counts.set(label, (counts.get(label) || 0) + 1);
      }
      if (note.labels.length === 0) {
        counts.set('(untagged)', (counts.get('(untagged)') || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [notes]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 select-none"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-white dark:bg-[#141519] border border-black/10 dark:border-white/10 rounded-xl shadow-2xl text-zinc-800 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.04] dark:border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold">Import Google Knowledge</span>
            <Badge size="xs" variant="light" color="orange">
              Keep · Docs · Drive
            </Badge>
          </div>
          <ActionIcon onClick={handleClose} variant="subtle" color="gray" size="sm">
            <X className="w-4 h-4" />
          </ActionIcon>
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-3">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wide text-zinc-400">
            <span className={step === 'source' ? 'text-orange-500' : ''}>1 · Source</span>
            <span>→</span>
            <span className={step === 'preview' ? 'text-orange-500' : ''}>2 · Preview</span>
            <span>→</span>
            <span className={step === 'organize' ? 'text-orange-500' : ''}>3 · Organize</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {step === 'source' && (
            <>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Google Keep has no public consumer API. Use the unofficial{' '}
                <code className="text-[10px] bg-black/5 dark:bg-white/5 px-1 rounded">gkeepapi</code>{' '}
                live sync workaround, drop a{' '}
                <a
                  href="https://takeout.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-orange-500 inline-flex items-center gap-0.5 hover:underline"
                >
                  Google Takeout <ExternalLink className="w-3 h-3" />
                </a>{' '}
                Keep export, or connect Drive Docs when OAuth is configured.
              </p>

              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                  <Tabs.Tab value="keep" leftSection={<StickyNote className="w-3 h-3" />}>
                    Keep live / Takeout
                  </Tabs.Tab>
                  <Tabs.Tab value="paste" leftSection={<FileUp className="w-3 h-3" />}>
                    Paste notes
                  </Tabs.Tab>
                  <Tabs.Tab value="drive" leftSection={<HardDrive className="w-3 h-3" />}>
                    Drive / Docs
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="keep" className="pt-3 space-y-3">
                  <div className="rounded-lg border border-orange-500/20 bg-orange-500/[0.03] p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-xs font-semibold">Live Keep sync (gkeepapi)</span>
                      <Badge size="xs" variant="light" color="orange">
                        unofficial
                      </Badge>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      Prefer a Google oauth <span className="font-mono">master_token</span> with{' '}
                      <span className="font-mono">Keep.authenticate</span>. Password login is deprecated
                      and often blocked.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        value={keepEmail}
                        onChange={(e) => setKeepEmail(e.target.value)}
                        placeholder="Google email"
                        autoComplete="username"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent outline-none focus:border-orange-400"
                      />
                      <input
                        value={keepMasterToken}
                        onChange={(e) => setKeepMasterToken(e.target.value)}
                        placeholder="Master token (preferred)"
                        type="password"
                        autoComplete="off"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent outline-none focus:border-orange-400"
                      />
                    </div>
                    <input
                      value={keepPassword}
                      onChange={(e) => setKeepPassword(e.target.value)}
                      placeholder="Password (discouraged fallback)"
                      type="password"
                      autoComplete="current-password"
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent outline-none focus:border-orange-400"
                    />
                    <label className="flex items-center gap-2 text-[10px] text-zinc-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={keepIncludeArchived}
                        onChange={(e) => setKeepIncludeArchived(e.target.checked)}
                      />
                      Include archived notes
                    </label>
                    {keepHint && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">{keepHint}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="xs"
                        color="orange"
                        loading={isKeepSyncing}
                        leftSection={
                          isKeepSyncing ? undefined : <Sparkles className="w-3.5 h-3.5" />
                        }
                        onClick={() => handleKeepLiveSync()}
                      >
                        Sync Keep notes
                      </Button>
                      {keepEnvConfigured && (
                        <Button
                          size="xs"
                          variant="light"
                          color="orange"
                          loading={isKeepSyncing}
                          onClick={() => handleKeepLiveSync({ useEnv: true })}
                        >
                          Sync with server env credentials
                        </Button>
                      )}
                    </div>
                  </div>

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      handleFiles(e.dataTransfer.files);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`py-8 px-4 border border-dashed rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                      dragActive
                        ? 'border-orange-500 bg-orange-500/[0.04]'
                        : 'border-zinc-300 dark:border-zinc-700 hover:border-orange-400'
                    }`}
                  >
                    {isParsing ? (
                      <Loader2 className="w-7 h-7 text-orange-500 mb-2 animate-spin" />
                    ) : (
                      <FileUp className="w-7 h-7 text-orange-500 mb-2" />
                    )}
                    <p className="text-xs font-medium">
                      Or drop Keep Takeout ZIP / JSON / HTML, or{' '}
                      <span className="text-orange-500 underline">browse</span>
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      takeout.google.com → Keep → export
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".zip,.json,.html,.htm,.md,.txt"
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                  </div>
                  <Button
                    variant="subtle"
                    color="gray"
                    size="xs"
                    onClick={handleLoadSample}
                  >
                    Load sample Google notes (demo)
                  </Button>
                </Tabs.Panel>

                <Tabs.Panel value="paste" className="pt-3 space-y-2">
                  <Textarea
                    minRows={8}
                    placeholder={'Meeting notes title\nBody of the note...\n\n# Another note\nMore content'}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.currentTarget.value)}
                    styles={{
                      input: {
                        fontSize: 12,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      },
                    }}
                  />
                  <Button size="xs" color="orange" onClick={handlePasteImport}>
                    Parse pasted notes
                  </Button>
                </Tabs.Panel>

                <Tabs.Panel value="drive" className="pt-3 space-y-3">
                  {driveConfigured ? (
                    <>
                      <p className="text-xs text-zinc-500">
                        Connect your Google account to pull Docs and Drive text files into the surface.
                      </p>
                      <Button
                        size="xs"
                        color="orange"
                        leftSection={<HardDrive className="w-3.5 h-3.5" />}
                        component="a"
                        href="/api/google/auth/start"
                      >
                        Connect Google Drive
                      </Button>
                    </>
                  ) : (
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-2">
                      <p className="text-xs text-zinc-600 dark:text-zinc-300">
                        Drive OAuth is not configured in this environment. Set{' '}
                        <code className="text-[10px] bg-black/5 dark:bg-white/5 px-1 rounded">
                          GOOGLE_CLIENT_ID
                        </code>{' '}
                        and{' '}
                        <code className="text-[10px] bg-black/5 dark:bg-white/5 px-1 rounded">
                          GOOGLE_CLIENT_SECRET
                        </code>{' '}
                        to enable live Docs sync. Until then, use Keep Takeout or paste.
                      </p>
                      <Button size="xs" variant="light" color="orange" onClick={handleLoadSample}>
                        Try with sample notes
                      </Button>
                    </div>
                  )}
                </Tabs.Panel>
              </Tabs>
            </>
          )}

          {step === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-semibold">
                    {notes.length} notes ready
                  </span>
                </div>
                <Button size="xs" variant="subtle" color="gray" onClick={() => setStep('source')}>
                  Change source
                </Button>
              </div>

              {labelSummary.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {labelSummary.map(([label, count]) => (
                    <Badge key={label} size="xs" variant="light" color="gray">
                      {label} · {count}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="max-h-56 overflow-y-auto rounded-lg border border-black/[0.06] dark:border-white/[0.06] divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {notes.slice(0, 40).map((note) => (
                  <div key={note.id} className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {note.title}
                      </span>
                      <Badge size="xs" variant="dot" color="orange">
                        {note.source}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2">
                      {note.content.slice(0, 160)}
                    </p>
                  </div>
                ))}
                {notes.length > 40 && (
                  <div className="px-3 py-2 text-[10px] text-zinc-400">
                    +{notes.length - 40} more notes
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createNewBoard}
                  onChange={(e) => setCreateNewBoard(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                Create a dedicated whiteboard for this import
              </label>
              {createNewBoard && (
                <input
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent outline-none focus:border-orange-400"
                  placeholder="Board name"
                />
              )}
            </div>
          )}

          {step === 'organize' && (
            <div className="space-y-3">
              {isOrganizing || !organization ? (
                <div className="py-10 flex flex-col items-center gap-3 text-xs text-zinc-500">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                  <p>Model is clustering themes, summarizing, and finding connections…</p>
                  <Progress value={66} color="orange" size="sm" className="w-48" animated />
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-orange-500/20 bg-orange-500/[0.04] p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-xs font-semibold">Intelligence overview</span>
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      {organization.overview}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {organization.clusters.map((cluster) => (
                      <div
                        key={cluster.id}
                        className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium truncate">{cluster.name}</span>
                          <Badge size="xs" variant="light" color="orange">
                            {cluster.noteIds.length}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1 line-clamp-3">
                          {cluster.summary}
                        </p>
                      </div>
                    ))}
                  </div>

                  {organization.connections.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold">
                        <Link2 className="w-3.5 h-3.5 text-orange-500" />
                        Connections ({organization.connections.length})
                      </div>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {organization.connections.slice(0, 8).map((c, idx) => (
                          <p key={idx} className="text-[10px] text-zinc-500">
                            <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                              {c.label}
                            </span>{' '}
                            — {c.reasoning}{' '}
                            <span className="font-mono text-zinc-400">
                              ({Math.round(c.confidence * 100)}%)
                            </span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between gap-2">
          <Button variant="subtle" color="gray" size="xs" onClick={handleClose}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <Button
                size="xs"
                color="orange"
                leftSection={<Sparkles className="w-3.5 h-3.5" />}
                onClick={runOrganize}
              >
                Organize with AI
              </Button>
            )}
            {step === 'organize' && organization && !isOrganizing && (
              <Button
                size="xs"
                color="orange"
                leftSection={<CheckCircle2 className="w-3.5 h-3.5" />}
                onClick={() => {
                  onCommit({
                    notes,
                    organization,
                    createNewBoard,
                    boardName: boardName.trim() || 'Google Notes Surface',
                  });
                  reset();
                }}
              >
                Place on canvas
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
