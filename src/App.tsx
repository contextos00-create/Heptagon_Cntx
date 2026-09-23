import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Whiteboard, 
  SurfaceCard, 
  Connection, 
  CanvasTool, 
  ThemeMode 
} from './types/surface';
import { 
  LatentEngineState, 
  ComputationalViewMode, 
  DetectedContradiction, 
  ProvenanceTrace, 
  SemanticConnection,
  SemanticZoomLevel 
} from './types/latentIntelligence';
import { INITIAL_WHITEBOARDS } from './data/defaultBoards';
import { SurfaceCanvas } from './components/SurfaceCanvas';
import { TopToolbar } from './components/TopToolbar';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';
import { CardDetailModal } from './components/CardDetailModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { UploadModal } from './components/UploadModal';
import { LatentToolbar } from './components/LatentToolbar';
import { ComputationalViewOverlay } from './components/ComputationalViewOverlay';
import { GraphNativeSearch } from './components/GraphNativeSearch';
import { processFileToCard } from './utils/fileHelpers';
import { groupAndPositionUploadedCards } from './utils/cardIntelligence';
import { saveWhiteboardServerFn } from './lib/server-fns';
import { 
  analyzeSpatialRelationships, 
  detectContradictionsInCards, 
  generateEvidenceProvenance,
  detectAmbientMissingConnections,
  getSemanticZoomLevel,
  enrichConnectionSemantics
} from './utils/latentEngine';

const STORAGE_KEY = 'heptasurface_data_v3_intelligence';
const THEME_KEY = 'heptasurface_theme_v1';

export default function App() {
  // Theme state: dark / light
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Whiteboards data state
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading saved whiteboards:', e);
    }
    return INITIAL_WHITEBOARDS;
  });

  const [currentBoardId, setCurrentBoardId] = useState<string>(() => {
    return whiteboards[0]?.id || 'wb-system-design';
  });

  const currentBoard = whiteboards.find((b) => b.id === currentBoardId) || whiteboards[0];

  // Save whiteboards to localStorage and sync via TanStack Start Server Function
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(whiteboards));
      if (currentBoard) {
        saveWhiteboardServerFn(currentBoard);
      }
    } catch (e) {
      console.warn('Storage quota exceeded for local storage:', e);
    }
  }, [whiteboards, currentBoard]);

  // Active Tool
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');

  // Selected Card & Spotlight Card (for chat auto-zoom)
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>();
  const [spotlightCardId, setSpotlightCardId] = useState<string | undefined>();

  // Panels visibility (with protruding orange tabs when closed)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [autoZoomEnabled, setAutoZoomEnabled] = useState(true);

  // Modals & Overlays
  const [detailCard, setDetailCard] = useState<SurfaceCard | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isGraphSearchOpen, setIsGraphSearchOpen] = useState(false);
  const [activeFilterTag, setActiveFilterTag] = useState<string | undefined>();

  // Viewport State (panX, panY, zoom) - opens fully zoomed out to see whole surface scope
  const [viewState, setViewState] = useState({ panX: 20, panY: 20, zoom: 0.68 });

  // Semantic Zoom Level derivation
  const currentSemanticZoom: SemanticZoomLevel = useMemo(() => {
    return getSemanticZoomLevel(viewState.zoom);
  }, [viewState.zoom]);

  // LATENT COMPUTATIONAL LAYER STATE
  const [isLatentLayerActive, setIsLatentLayerActive] = useState(false);
  const [activeViewMode, setActiveViewMode] = useState<ComputationalViewMode>('whiteboard');
  const [timelineScrubTimestamp, setTimelineScrubTimestamp] = useState<number>(100);
  const [dynamicGroupingCriterion, setDynamicGroupingCriterion] = useState<LatentEngineState['dynamicGroupingCriterion']>('none');
  const [dismissedAiConnIds, setDismissedAiConnIds] = useState<Set<string>>(new Set());

  // Spatial awareness analysis (containment, clustering, proximity)
  const spatialAnalysis = useMemo(() => {
    return analyzeSpatialRelationships(currentBoard.cards, currentBoard.connections);
  }, [currentBoard.cards, currentBoard.connections]);

  // Automated Contradiction & Outdated Assumption Detection
  const contradictions: DetectedContradiction[] = useMemo(() => {
    return detectContradictionsInCards(currentBoard.cards);
  }, [currentBoard.cards]);

  // Evidence Provenance traces
  const provenanceTraces: ProvenanceTrace[] = useMemo(() => {
    return generateEvidenceProvenance(currentBoard.cards);
  }, [currentBoard.cards]);

  // Ambient AI: Missing relationships detection
  const ambientMissingConnections: SemanticConnection[] = useMemo(() => {
    const rawSuggestions = detectAmbientMissingConnections(currentBoard.cards, currentBoard.connections);
    return rawSuggestions.filter(s => !dismissedAiConnIds.has(s.id));
  }, [currentBoard.cards, currentBoard.connections, dismissedAiConnIds]);

  const latentEngineState: LatentEngineState = useMemo(() => ({
    isLatentLayerActive,
    territoryClusters: spatialAnalysis.territories,
    contradictions,
    provenanceTraces,
    suggestedMissingConnections: ambientMissingConnections,
    unsupportedClaims: [],
    activeViewMode,
    timelineScrubTimestamp,
    dynamicGroupingCriterion,
  }), [
    isLatentLayerActive, 
    spatialAnalysis.territories, 
    contradictions, 
    provenanceTraces, 
    ambientMissingConnections, 
    activeViewMode, 
    timelineScrubTimestamp, 
    dynamicGroupingCriterion
  ]);

  // Always compute full-scope zoomed out view to reveal the entire whiteboard surface
  const fitWholeSurfaceScope = useCallback((board: Whiteboard) => {
    if (!board || !board.cards.length) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    board.cards.forEach((c) => {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + c.width);
      maxY = Math.max(maxY, c.y + c.height);
    });

    const padding = 70;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;

    const winW = window.innerWidth - (isSidebarOpen ? 260 : 0) - (isChatOpen ? 340 : 0);
    const winH = window.innerHeight - 50;

    // Zoom all the way out to guarantee complete scope visibility
    const scale = Math.min(0.85, Math.max(0.2, Math.min(winW / contentW, winH / contentH)));
    const targetPanX = winW / 2 - (minX + (maxX - minX) / 2) * scale;
    const targetPanY = winH / 2 - (minY + (maxY - minY) / 2) * scale;

    setViewState({
      panX: targetPanX,
      panY: targetPanY,
      zoom: scale,
    });
  }, [isSidebarOpen, isChatOpen]);

  // Always open with whole scope zoomed out on initial load and when switching boards
  useEffect(() => {
    if (currentBoard) {
      const timer = setTimeout(() => {
        fitWholeSurfaceScope(currentBoard);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentBoardId, fitWholeSurfaceScope]);

  // Update current board in the list
  const updateCurrentBoard = useCallback(
    (updater: (b: Whiteboard) => Whiteboard) => {
      setWhiteboards((prev) =>
        prev.map((b) => (b.id === currentBoardId ? updater(b) : b))
      );
    },
    [currentBoardId]
  );

  // Card operations
  const handleUpdateCard = useCallback(
    (cardId: string, updates: Partial<SurfaceCard>) => {
      updateCurrentBoard((board) => ({
        ...board,
        cards: board.cards.map((c) =>
          c.id === cardId ? { ...c, ...updates, updatedAt: Date.now() } : c
        ),
      }));
    },
    [updateCurrentBoard]
  );

  const handleDeleteCard = useCallback(
    (cardId: string) => {
      updateCurrentBoard((board) => ({
        ...board,
        cards: board.cards.filter((c) => c.id !== cardId),
        connections: board.connections.filter(
          (c) => c.fromId !== cardId && c.toId !== cardId
        ),
      }));
      if (selectedCardId === cardId) setSelectedCardId(undefined);
      if (spotlightCardId === cardId) setSpotlightCardId(undefined);
    },
    [updateCurrentBoard, selectedCardId, spotlightCardId]
  );

  const handleDuplicateCard = useCallback(
    (card: SurfaceCard) => {
      const newId = 'card-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      const duplicated: SurfaceCard = {
        ...card,
        id: newId,
        title: card.title + ' (Copy)',
        x: card.x + 40,
        y: card.y + 40,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      updateCurrentBoard((board) => ({
        ...board,
        cards: [...board.cards, duplicated],
      }));
      setSelectedCardId(newId);
    },
    [updateCurrentBoard]
  );

  const handleAddCard = useCallback(
    (newCard: Partial<SurfaceCard>) => {
      const cardId = 'card-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      const created: SurfaceCard = {
        id: cardId,
        type: newCard.type || 'note',
        title: newCard.title || 'Untitled Thought',
        content: newCard.content || '',
        x: newCard.x || 300,
        y: newCard.y || 200,
        width: newCard.width || 280,
        height: newCard.height || 180,
        color: newCard.color || 'default',
        tags: newCard.tags || ['KNOWLEDGE'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...newCard,
      };
      updateCurrentBoard((board) => ({
        ...board,
        cards: [...board.cards, created],
      }));
      setSelectedCardId(cardId);
    },
    [updateCurrentBoard]
  );

  const handleAddMultipleCardsAndConnections = useCallback(
    (newCards: SurfaceCard[], newConnections: Connection[]) => {
      updateCurrentBoard((board) => ({
        ...board,
        cards: [...board.cards, ...newCards],
        connections: [...board.connections, ...newConnections],
      }));
      if (newCards.length > 0) {
        setSelectedCardId(newCards[0].id);
      }
    },
    [updateCurrentBoard]
  );

  // Connection operations
  const handleAddConnection = useCallback(
    (connection: Partial<Connection>) => {
      if (!connection.fromId || !connection.toId) return;
      const fromId = connection.fromId;
      const toId = connection.toId;

      const exists = currentBoard.connections.some(
        (c) => c.fromId === fromId && c.toId === toId
      );
      if (exists || fromId === toId) return;

      const newConn: Connection = {
        id: 'conn-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        fromId,
        toId,
        label: connection.label || 'relates_to',
        color: connection.color || '#3b82f6',
        style: connection.style || 'solid',
      };

      updateCurrentBoard((board) => ({
        ...board,
        connections: [...board.connections, newConn],
      }));
    },
    [currentBoard.connections, updateCurrentBoard]
  );

  const handleDeleteConnection = useCallback(
    (connectionId: string) => {
      updateCurrentBoard((board) => ({
        ...board,
        connections: board.connections.filter((c) => c.id !== connectionId),
      }));
    },
    [updateCurrentBoard]
  );

  // Smooth camera zoom to specific card
  const handleZoomToCard = useCallback(
    (cardId: string) => {
      const card = currentBoard.cards.find((c) => c.id === cardId);
      if (!card) return;

      setSelectedCardId(cardId);
      setSpotlightCardId(cardId);

      const winW = window.innerWidth - (isSidebarOpen ? 260 : 0) - (isChatOpen ? 340 : 0);
      const winH = window.innerHeight - 50;
      const targetZoom = 1.1;
      const targetPanX = winW / 2 - (card.x + card.width / 2) * targetZoom;
      const targetPanY = winH / 2 - (card.y + card.height / 2) * targetZoom;

      setViewState({
        panX: targetPanX,
        panY: targetPanY,
        zoom: targetZoom,
      });

      setTimeout(() => {
        setSpotlightCardId(undefined);
      }, 2500);
    },
    [currentBoard.cards, isSidebarOpen, isChatOpen]
  );

  // Zoom controls
  const handleZoomIn = () => {
    setViewState((prev) => ({
      ...prev,
      zoom: Math.min(2.5, prev.zoom * 1.2),
    }));
  };

  const handleZoomOut = () => {
    setViewState((prev) => ({
      ...prev,
      zoom: Math.max(0.15, prev.zoom / 1.2),
    }));
  };

  const handleResetZoom = () => {
    setViewState((prev) => ({
      ...prev,
      zoom: 1.0,
    }));
  };

  const handleFitView = () => {
    fitWholeSurfaceScope(currentBoard);
  };

  // Add new note at center of viewport
  const handleAddNewNote = () => {
    const winW = window.innerWidth - (isSidebarOpen ? 260 : 0);
    const winH = window.innerHeight - 50;
    const worldX = (winW / 2 - viewState.panX) / viewState.zoom - 140;
    const worldY = (winH / 2 - viewState.panY) / viewState.zoom - 90;

    handleAddCard({
      type: 'note',
      title: 'New Note',
      content: '',
      x: Math.round(worldX),
      y: Math.round(worldY),
      width: 280,
      height: 180,
      color: 'default',
      tags: ['NOTE'],
    });
  };

  // Add new section group
  const handleAddNewSection = () => {
    const winW = window.innerWidth - (isSidebarOpen ? 260 : 0);
    const winH = window.innerHeight - 50;
    const worldX = (winW / 2 - viewState.panX) / viewState.zoom - 200;
    const worldY = (winH / 2 - viewState.panY) / viewState.zoom - 150;

    handleAddCard({
      type: 'section',
      title: 'New Concept Cluster',
      content: 'Synthesized group area',
      x: Math.round(worldX),
      y: Math.round(worldY),
      width: 480,
      height: 340,
      color: 'blue',
      tags: ['CLUSTER'],
    });
  };

  // Auto arrange all cards into tidy grid
  const handleAutoArrange = () => {
    const margin = 24;
    const cols = Math.ceil(Math.sqrt(currentBoard.cards.length));
    let curX = 60;
    let curY = 60;
    let maxHInRow = 0;

    const arrangedCards = currentBoard.cards.map((c, i) => {
      const colIdx = i % cols;
      if (colIdx === 0 && i !== 0) {
        curX = 60;
        curY += maxHInRow + margin;
        maxHInRow = 0;
      }

      const updated = {
        ...c,
        x: curX,
        y: curY,
      };

      curX += c.width + margin;
      maxHInRow = Math.max(maxHInRow, c.height);
      return updated;
    });

    updateCurrentBoard((board) => ({
      ...board,
      cards: arrangedCards,
    }));
  };

  // Predictive Actions (Context-sensitive operations)
  const handlePredictiveAction = (
    action: 'compare' | 'find_relations' | 'trace_evidence' | 'find_contradictions' | 'timeline',
    card: SurfaceCard
  ) => {
    if (action === 'trace_evidence') {
      setActiveViewMode('evidence');
    } else if (action === 'find_contradictions') {
      setIsLatentLayerActive(true);
      const matched = contradictions.find(c => c.cardAId === card.id || c.cardBId === card.id);
      if (matched) {
        handleZoomToCard(matched.cardAId === card.id ? matched.cardBId : matched.cardAId);
      }
    } else if (action === 'find_relations') {
      setIsLatentLayerActive(true);
      setActiveViewMode('graph');
    } else if (action === 'timeline') {
      setActiveViewMode('timeline');
    } else if (action === 'compare') {
      // Find nearest counterpart card in surface and focus
      const other = currentBoard.cards.find(c => c.id !== card.id && c.type !== 'section');
      if (other) {
        handleZoomToCard(other.id);
      }
    }
  };

  // Dynamic Grouping Reorganization (Non-destructive or instant reorganization)
  const handleDynamicGrouping = (criterion: LatentEngineState['dynamicGroupingCriterion']) => {
    setDynamicGroupingCriterion(criterion);
    if (criterion === 'none') return;

    let groupedCards = [...currentBoard.cards];
    let startX = 60;
    let startY = 60;

    if (criterion === 'ontology') {
      const colors = ['blue', 'purple', 'green', 'orange', 'red', 'yellow', 'default', 'gray'];
      let curX = 60;
      colors.forEach(col => {
        const matching = groupedCards.filter(c => c.color === col && c.type !== 'section');
        if (matching.length > 0) {
          let curY = 60;
          matching.forEach(c => {
            c.x = curX;
            c.y = curY;
            curY += c.height + 20;
          });
          curX += 340;
        }
      });
    } else if (criterion === 'contradiction') {
      // Place conflicting cards side by side
      if (contradictions.length > 0) {
        contradictions.forEach((cnt, idx) => {
          const cardA = groupedCards.find(c => c.id === cnt.cardAId);
          const cardB = groupedCards.find(c => c.id === cnt.cardBId);
          if (cardA && cardB) {
            cardA.x = 80;
            cardA.y = 80 + idx * 300;
            cardB.x = 420;
            cardB.y = 80 + idx * 300;
          }
        });
      }
    }

    updateCurrentBoard(board => ({
      ...board,
      cards: groupedCards,
    }));
  };

  // Temporal scrub filter (Simulate state history progression)
  const displayedCards = useMemo(() => {
    let list = currentBoard.cards;
    if (activeFilterTag) {
      list = list.filter((c) => c.tags.includes(activeFilterTag) || c.type === 'section');
    }
    if (timelineScrubTimestamp < 100) {
      const countToKeep = Math.max(1, Math.round((list.length * timelineScrubTimestamp) / 100));
      list = list.slice(0, countToKeep);
    }
    return list;
  }, [currentBoard.cards, activeFilterTag, timelineScrubTimestamp]);

  // Upload modal callback
  const handleFilesUploaded = async (files: File[]) => {
    const winW = window.innerWidth - (isSidebarOpen ? 260 : 0);
    const winH = window.innerHeight - 50;
    const worldX = (winW / 2 - viewState.panX) / viewState.zoom - 200;
    const worldY = (winH / 2 - viewState.panY) / viewState.zoom - 150;

    const cardPromises = files.map((file, idx) =>
      processFileToCard(file, worldX + idx * 40, worldY + idx * 40)
    );
    const processedCards = await Promise.all(cardPromises);

    const { newCards, newConnections } = groupAndPositionUploadedCards(
      processedCards,
      worldX,
      worldY
    );

    handleAddMultipleCardsAndConnections(newCards, newConnections);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-[#0c0d10] font-sans antialiased text-zinc-900 dark:text-zinc-100">
      
      {/* Left Collapsible Navigation (With Protruding Orange Tab When Hidden) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        whiteboards={whiteboards}
        currentBoardId={currentBoardId}
        onSelectBoard={setCurrentBoardId}
        onCreateBoard={() => {
          const newBoardId = 'wb-' + Date.now();
          const newBoard: Whiteboard = {
            id: newBoardId,
            name: `Board ${whiteboards.length + 1}`,
            description: 'Exploration space',
            cards: [],
            connections: [],
            viewState: { panX: 20, panY: 20, zoom: 0.68 },
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          setWhiteboards((prev) => [...prev, newBoard]);
          setCurrentBoardId(newBoardId);
        }}
        onDeleteBoard={(boardId) => {
          if (whiteboards.length <= 1) return;
          setWhiteboards((prev) => prev.filter((b) => b.id !== boardId));
          if (currentBoardId === boardId) {
            const next = whiteboards.find((b) => b.id !== boardId);
            if (next) setCurrentBoardId(next.id);
          }
        }}
        cards={currentBoard.cards}
        onZoomToCard={handleZoomToCard}
        activeFilterTag={activeFilterTag}
        onSelectFilterTag={setActiveFilterTag}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* Main Workspace Surface Container */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Top Minimal Application Chrome */}
        <TopToolbar
          boardName={currentBoard.name}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          zoom={viewState.zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          onFitView={handleFitView}
          isChatOpen={isChatOpen}
          onToggleChat={() => setIsChatOpen(!isChatOpen)}
          theme={theme}
          onToggleTheme={toggleTheme}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onAddNewNote={handleAddNewNote}
          onAddNewSection={handleAddNewSection}
          onTriggerFileUpload={() => setIsUploadModalOpen(true)}
          onAutoArrange={handleAutoArrange}
          onOpenGraphSearch={() => setIsGraphSearchOpen(true)}
        />

        {/* Canvas & Right Chat Panel Flex Container */}
        <div className="flex-1 flex w-full h-[calc(100vh-48px)] relative overflow-hidden">
          {/* Visual Whiteboarding Canvas Surface */}
          <div className="flex-1 h-full relative">
            <SurfaceCanvas
              cards={displayedCards}
              connections={currentBoard.connections}
              activeTool={activeTool}
              spotlightCardId={spotlightCardId}
              selectedCardId={selectedCardId}
              onSelectCard={setSelectedCardId}
              onUpdateCard={handleUpdateCard}
              onDeleteCard={handleDeleteCard}
              onDuplicateCard={handleDuplicateCard}
              onAddCard={handleAddCard}
              onAddMultipleCardsAndConnections={handleAddMultipleCardsAndConnections}
              onAddConnection={handleAddConnection}
              onDeleteConnection={handleDeleteConnection}
              onOpenDetail={(card) => setDetailCard(card)}
              isChatOpen={isChatOpen}
              isSidebarOpen={isSidebarOpen}
              viewState={viewState}
              onUpdateViewState={setViewState}
              isLatentLayerActive={isLatentLayerActive}
              territories={spatialAnalysis.territories}
              onPredictiveAction={handlePredictiveAction}
            />

            {/* Canvas Bottom-Left Status & Hints */}
            <div className="absolute bottom-2.5 left-3 pointer-events-none text-[11px] text-zinc-500 dark:text-zinc-400 select-none flex items-center gap-2">
              <span>{currentBoard.cards.length} cards</span>
              <span>•</span>
              <span className="font-mono text-[10px]">{Math.round(viewState.zoom * 100)}% scope</span>
              <span>•</span>
              <span className="font-mono text-[10px] uppercase text-orange-600 dark:text-orange-400">
                LOD: {currentSemanticZoom}
              </span>
            </div>

            {/* Latent Intelligence Floating Control Bar & Insights */}
            <LatentToolbar
              engineState={latentEngineState}
              zoomLevel={currentSemanticZoom}
              cards={currentBoard.cards}
              connections={currentBoard.connections}
              onToggleLatentLayer={() => setIsLatentLayerActive(!isLatentLayerActive)}
              onChangeViewMode={setActiveViewMode}
              onChangeGrouping={handleDynamicGrouping}
              onScrubTimeline={setTimelineScrubTimestamp}
              onAcceptSuggestedConnection={(suggested) => {
                handleAddConnection(suggested);
                setDismissedAiConnIds(prev => new Set(prev).add(suggested.id));
              }}
              onDismissSuggestedConnection={(id) => {
                setDismissedAiConnIds(prev => new Set(prev).add(id));
              }}
              onFocusCard={handleZoomToCard}
            />

            {/* Multiple Computational Views (Graph, Timeline, Dependency, Evidence) */}
            <ComputationalViewOverlay
              viewMode={activeViewMode}
              cards={currentBoard.cards}
              connections={currentBoard.connections}
              contradictions={contradictions}
              provenanceTraces={provenanceTraces}
              onCloseView={() => setActiveViewMode('whiteboard')}
              onFocusCard={handleZoomToCard}
            />
          </div>

          {/* Right AI Copilot & Chat Panel (With Protruding Orange Tab When Hidden) */}
          <ChatPanel
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            onOpen={() => setIsChatOpen(true)}
            cards={currentBoard.cards}
            onZoomToCard={handleZoomToCard}
            autoZoomEnabled={autoZoomEnabled}
            onToggleAutoZoom={() => setAutoZoomEnabled(!autoZoomEnabled)}
          />
        </div>
      </main>

      {/* Full Card Reader & Editor Modal */}
      {detailCard && (
        <CardDetailModal
          card={detailCard}
          allCards={currentBoard.cards}
          connections={currentBoard.connections}
          onClose={() => setDetailCard(null)}
          onUpdateCard={handleUpdateCard}
          onDeleteCard={handleDeleteCard}
          onNavigateToCard={handleZoomToCard}
        />
      )}

      {/* Keyboard & Canvas Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* File Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onFilesSelected={handleFilesUploaded}
      />

      {/* Graph Native Search Modal */}
      <GraphNativeSearch
        isOpen={isGraphSearchOpen}
        onClose={() => setIsGraphSearchOpen(false)}
        cards={currentBoard.cards}
        connections={currentBoard.connections}
        onFocusCard={handleZoomToCard}
      />
    </div>
  );
}
