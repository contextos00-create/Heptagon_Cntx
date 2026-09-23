import React from 'react';
import { X, Command } from 'lucide-react';
import { Kbd, Badge, ActionIcon } from '@mantine/core';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { 
      label: 'Pan canvas', 
      keys: [<Kbd key="1">Space</Kbd>, ' + Drag, or middle-click'],
      desc: 'Freely navigate across infinite whiteboard coordinates' 
    },
    { 
      label: 'Select tool', 
      keys: [<Kbd key="v">V</Kbd>],
      desc: 'Activate pointer tool for selecting and dragging nodes' 
    },
    { 
      label: 'New note card', 
      keys: [<Kbd key="c">C</Kbd>],
      desc: 'Create a new atomic note card' 
    },
    { 
      label: 'New section cluster', 
      keys: [<Kbd key="s">S</Kbd>],
      desc: 'Draw a boundary region to enclose related concepts' 
    },
    { 
      label: 'Zoom in / out', 
      keys: [<Kbd key="wheel">Wheel</Kbd>, ' / Pinch'],
      desc: 'Continuous LOD semantic zoom across 5 computational tiers' 
    },
    { 
      label: 'Connect cards', 
      keys: ['Drag handle'],
      desc: 'Drag circle node handle to any card to create typed semantic vectors' 
    },
    { 
      label: 'Inspect / reader', 
      keys: [<Kbd key="dbl">Double-click</Kbd>],
      desc: 'Open comprehensive card reader with document metadata' 
    },
    { 
      label: 'Text drill-down', 
      keys: ['Highlight text'],
      desc: 'Select text inside any card to spawn a connected contextual sub-card' 
    },
    { 
      label: 'Interactive map pins', 
      keys: ['Click location'],
      desc: 'Click geographic names to spawn live interactive satellite maps' 
    },
    { 
      label: 'TanStack AI Copilot', 
      keys: ['Copilot tab'],
      desc: 'Voice or text query with auto-focus camera and contradiction detection' 
    },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-white dark:bg-[#141519] border border-black/10 dark:border-white/10 rounded-xl shadow-2xl p-5 text-zinc-800 dark:text-zinc-100 animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.04] dark:border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Command className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Workspace & Canvas Shortcuts
            </span>
            <Badge size="xs" variant="light" color="orange">
              Mantine 9.5
            </Badge>
          </div>
          <ActionIcon onClick={onClose} variant="subtle" color="gray" size="sm">
            <X className="w-4 h-4" />
          </ActionIcon>
        </div>

        <div className="py-3 divide-y divide-black/[0.04] dark:divide-white/[0.04] max-h-[70vh] overflow-y-auto">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="py-2.5 flex items-start justify-between gap-4">
              <div>
                <div className="font-medium text-zinc-900 dark:text-zinc-200 text-xs">
                  {s.label}
                </div>
                <div className="text-[11px] text-zinc-500 leading-normal mt-0.5">
                  {s.desc}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1 text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                {s.keys.map((k, kIdx) => (
                  <React.Fragment key={kIdx}>{k}</React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
