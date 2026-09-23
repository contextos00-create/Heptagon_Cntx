import React from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, Smartphone, Focus, Layers, ChevronDown } from 'lucide-react';
import { Menu } from '@mantine/core';
import { SurfaceCard } from '../types/surface';

interface MobileSectionNavProps {
  sections: SurfaceCard[];
  currentSectionIndex: number;
  onSelectSection: (index: number) => void;
  isMobileStackActive: boolean;
  onToggleMobileStack: () => void;
  onFocusCurrentSection: () => void;
  totalCards: number;
}

export const MobileSectionNav: React.FC<MobileSectionNavProps> = ({
  sections,
  currentSectionIndex,
  onSelectSection,
  isMobileStackActive,
  onToggleMobileStack,
  onFocusCurrentSection,
  totalCards,
}) => {
  if (sections.length === 0) return null;

  const activeSection = sections[currentSectionIndex] || sections[0];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (currentSectionIndex - 1 + sections.length) % sections.length;
    onSelectSection(nextIdx);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (currentSectionIndex + 1) % sections.length;
    onSelectSection(nextIdx);
  };

  return (
    <div className="md:hidden absolute top-2 inset-x-2 z-40 pointer-events-none flex flex-col items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="pointer-events-auto w-full max-w-md bg-white/95 dark:bg-[#121316]/95 border border-black/10 dark:border-white/10 rounded-xl shadow-lg backdrop-blur-md px-2 py-1.5 flex items-center justify-between text-xs">
        
        {/* Navigation Arrows & Section Dropdown */}
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <button
            onClick={handlePrev}
            className="p-1 rounded-md bg-black/5 dark:bg-white/5 active:bg-orange-500 active:text-white text-zinc-700 dark:text-zinc-300 transition-colors shrink-0"
            title="Previous Zone"
            aria-label="Previous Zone"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <Menu shadow="md" width={280}>
            <Menu.Target>
              <button
                className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left min-w-0 flex-1"
                title="Select Section"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-orange-600 dark:text-orange-400 font-bold shrink-0">
                      Zone {currentSectionIndex + 1}/{sections.length}
                    </span>
                    <span className="text-[9px] text-zinc-400 shrink-0">•</span>
                    <span className="text-[9px] text-zinc-400 font-mono shrink-0">
                      {totalCards} cards
                    </span>
                  </div>
                  <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-1">
                    <span className="truncate">{activeSection.title}</span>
                    <ChevronDown className="w-2.5 h-2.5 opacity-50 shrink-0" />
                  </div>
                </div>
              </button>
            </Menu.Target>

            <Menu.Dropdown className="text-xs">
              <Menu.Label className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                Board Zones ({sections.length})
              </Menu.Label>
              {sections.map((sec, idx) => (
                <Menu.Item
                  key={sec.id}
                  onClick={() => onSelectSection(idx)}
                  className={idx === currentSectionIndex ? 'bg-orange-500/10 font-semibold text-orange-600 dark:text-orange-400' : ''}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="truncate mr-2">
                      <span className="font-mono text-[10px] text-zinc-400 mr-1.5">{idx + 1}.</span>
                      <span>{sec.title}</span>
                    </div>
                  </div>
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>

          <button
            onClick={handleNext}
            className="p-1 rounded-md bg-black/5 dark:bg-white/5 active:bg-orange-500 active:text-white text-zinc-700 dark:text-zinc-300 transition-colors shrink-0"
            title="Next Zone"
            aria-label="Next Zone"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Mobile Action Buttons */}
        <div className="flex items-center gap-1 shrink-0 ml-1.5 border-l border-zinc-200 dark:border-zinc-800 pl-1.5">
          {/* Re-center / Focus current zone */}
          <button
            onClick={onFocusCurrentSection}
            className="px-2 py-1 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 active:scale-95 text-zinc-700 dark:text-zinc-300 font-medium text-[10px] flex items-center gap-1"
            title="Focus Zone (Zero whitespace)"
          >
            <Focus className="w-3 h-3 text-orange-500 shrink-0" />
            <span>Focus</span>
          </button>

          {/* Toggle Mobile Vertical Stack */}
          <button
            onClick={onToggleMobileStack}
            className={`px-2 py-1 rounded active:scale-95 font-medium text-[10px] flex items-center gap-1 transition-all ${
              isMobileStackActive
                ? 'bg-orange-500 text-white shadow-xs font-semibold'
                : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/20'
            }`}
            title={isMobileStackActive ? 'Return to desktop spatial layout' : 'Reflow into a vertical mobile stack with zero dead space'}
          >
            {isMobileStackActive ? (
              <>
                <LayoutGrid className="w-3 h-3 shrink-0" />
                <span>Spatial</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3 h-3 shrink-0" />
                <span>Stack</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
