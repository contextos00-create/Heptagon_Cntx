import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  Download, 
  ArrowRight, 
  ArrowLeft
} from 'lucide-react';
import { Badge, Tooltip, ActionIcon } from '@mantine/core';
import { SurfaceCard, Connection } from '../types/surface';
import { formatBytes } from '../utils/fileHelpers';

interface CardDetailModalProps {
  card: SurfaceCard | null;
  allCards: SurfaceCard[];
  connections: Connection[];
  onClose: () => void;
  onUpdateCard: (id: string, updates: Partial<SurfaceCard>) => void;
  onDeleteCard: (id: string) => void;
  onNavigateToCard: (cardId: string) => void;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({
  card,
  allCards,
  connections,
  onClose,
  onUpdateCard,
  onDeleteCard,
  onNavigateToCard,
}) => {
  if (!card) return null;

  const [title, setTitle] = useState(card.title);
  const [content, setContent] = useState(card.content);
  const [newTag, setNewTag] = useState('');

  // Find incoming & outgoing connected cards
  const outgoingCards = connections
    .filter(c => c.fromId === card.id)
    .map(c => ({
      connection: c,
      target: allCards.find(ac => ac.id === c.toId)
    }))
    .filter(item => item.target !== undefined);

  const incomingCards = connections
    .filter(c => c.toId === card.id)
    .map(c => ({
      connection: c,
      source: allCards.find(ac => ac.id === c.fromId)
    }))
    .filter(item => item.source !== undefined);

  const handleTitleBlur = () => {
    if (title.trim() && title !== card.title) {
      onUpdateCard(card.id, { title: title.trim(), updatedAt: Date.now() });
    }
  };

  const handleContentBlur = () => {
    if (content !== card.content) {
      onUpdateCard(card.id, { content, updatedAt: Date.now() });
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      const clean = newTag.trim().toLowerCase().replace(/^#/, '');
      if (!card.tags.includes(clean)) {
        onUpdateCard(card.id, { tags: [...card.tags, clean], updatedAt: Date.now() });
      }
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateCard(card.id, {
      tags: card.tags.filter(t => t !== tagToRemove),
      updatedAt: Date.now(),
    });
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 sm:p-6"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl max-h-[85vh] bg-white dark:bg-[#141519] border border-black/10 dark:border-white/10 rounded-lg shadow-2xl flex flex-col overflow-hidden text-zinc-800 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Editorial Top Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-black/[0.04] dark:border-white/[0.04]">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Badge variant="outline" color="orange" size="sm" className="capitalize">
              {card.type}
            </Badge>
            {card.fileMetadata && (
              <span className="font-mono text-[11px]">• {formatBytes(card.fileMetadata.size)}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {card.fileMetadata?.dataUrl && (
              <a
                href={card.fileMetadata.dataUrl}
                download={card.fileMetadata.name}
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                title="Download"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={() => {
                onDeleteCard(card.id);
                onClose();
              }}
              className="p-1 text-zinc-400 hover:text-rose-500"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {/* Card Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Title"
              className="w-full text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 bg-transparent border-none outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
            />
          </div>

          {/* Image preview */}
          {card.type === 'image' && card.fileMetadata?.dataUrl && (
            <div className="rounded overflow-hidden bg-zinc-50 dark:bg-black/30 border border-black/5 dark:border-white/5 flex items-center justify-center p-2 max-h-72">
              <img
                src={card.fileMetadata.dataUrl}
                alt={card.title}
                className="max-h-64 max-w-full object-contain"
              />
            </div>
          )}

          {/* Body Content Editor */}
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={handleContentBlur}
              rows={9}
              placeholder="Type your notes..."
              className="w-full text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 bg-transparent resize-y outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-700 font-sans"
            />
          </div>

          {/* Tags */}
          <div className="pt-4 border-t border-black/[0.04] dark:border-white/[0.04]">
            <div className="flex items-center gap-1.5 flex-wrap">
              {card.tags.map((tag) => (
                <Badge
                  key={tag}
                  size="sm"
                  variant="light"
                  color="gray"
                  className="cursor-pointer"
                  onClick={() => handleRemoveTag(tag)}
                  title="Click to remove"
                >
                  #{tag} ×
                </Badge>
              ))}
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="+ tag"
                className="text-xs text-zinc-400 bg-transparent outline-none w-16"
              />
            </div>
          </div>

          {/* Connected Cards */}
          {(incomingCards.length > 0 || outgoingCards.length > 0) && (
            <div className="pt-4 border-t border-black/[0.04] dark:border-white/[0.04] text-xs text-zinc-500 space-y-2">
              <div className="text-[11px] font-medium text-zinc-400">Connections</div>
              <div className="flex flex-wrap gap-2">
                {incomingCards.map(({ source }) => source && (
                  <button
                    key={source.id}
                    onClick={() => {
                      onNavigateToCard(source.id);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-black/[0.02] dark:bg-white/[0.03] hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    <ArrowLeft className="w-3 h-3 text-zinc-400" />
                    <span>{source.title}</span>
                  </button>
                ))}
                {outgoingCards.map(({ target }) => target && (
                  <button
                    key={target.id}
                    onClick={() => {
                      onNavigateToCard(target.id);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-black/[0.02] dark:bg-white/[0.03] hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    <span>{target.title}</span>
                    <ArrowRight className="w-3 h-3 text-zinc-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
