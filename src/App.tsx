import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Whiteboard, 
  SurfaceCard, 
  Connection, 
  CanvasTool, 
  ThemeMode,
  GraphLayoutAlgorithm,
  EdgeRoutingMode,
  LayoutTightness,
  nextThemeMode,
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
import { GoogleImportModal, GoogleImportCommitPayload } from './components/GoogleImportModal';
import { LatentToolbar } from './components/LatentToolbar';
import { ComputationalViewOverlay } from './components/ComputationalViewOverlay';
import { GraphNativeSearch } from './components/GraphNativeSearch';
import { WorkspaceDataGridModal } from './components/WorkspaceDataGridModal';
import { MobileSectionNav } from './components/MobileSectionNav';
import { processFileToCard } from './utils/fileHelpers';
import { groupAndPositionUploadedCards } from './utils/cardIntelligence';
import { placeOrganizedNotesOnCanvas } from './utils/googleNotesOrganizer';
import { createDataGridCard, generateScaleStressTestNodes } from './utils/scaleGenerator';
import { saveWhiteboardServerFn } from './lib/server-fns';
import { 
  analyzeSpatialRelationships, 
  detectContradictionsInCards, 
  generateEvidenceProvenance,
  detectAmbientMissingConnections,
  getSemanticZoomLevel,
  enrichConnectionSemantics
} from './utils/latentEngine';
import { applyGraphLayout } from './utils/graphLayoutEngine';

const STORAGE_KEY = 'heptasurface_data_v4_scale_datagrid';
const THEME_KEY = 'heptasurface_theme_v2';

export default function App() {
  // Theme state: light / dark / hepta-dark (optional blueprint skin from Hepta_dark)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'hepta-dark') return saved;
    // migrate v1 key
    const legacy = localStorage.getItem('heptasurface_theme_v1');
    if (legacy === 'dark' || legacy === 'light') return legacy;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'skin-hepta-dark');
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'hepta-dark') {
      root.classList.add('dark', 'skin-hepta-dark');
    }
    root.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    window.dispatchEvent(new CustomEvent('hepta-theme-change', { detail: theme }));
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => nextThemeMode(prev));
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
  const [isGoogleImportOpen, setIsGoogleImportOpen] = useState(false);
  const [driveConfigured, setDriveConfigured] = useState(false);
  const [keepEnvConfigured, setKeepEnvConfigured] = useState(false);
  const [keepSessionEmail, setKeepSessionEmail] = useState<string | null>(null);
  const [isGraphSearchOpen, setIsGraphSearchOpen] = useState(false);
  const [isDataGridMatrixOpen, setIsDataGridMatrixOpen] = useState(false);
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

  // Graph Layout & Obstacle-Avoidance Edge Routing State
  const [layoutTightness, setLayoutTightness] = useState<LayoutTightness>('tight');
  const [edgeRoutingMode, setEdgeRoutingMode] = useState<EdgeRoutingMode>('orthogonal-avoid');

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

  // Mobile section navigation and layout state
  const [activeSectionIndex, setActiveSectionIndex] = useState<number>(0);
  const [isMobileStackActive, setIsMobileStackActive] = useState<boolean>(false);
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => 
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Probe whether Google Drive OAuth / Keep gkeepapi env credentials are configured
  useEffect(() => {
    fetch('/api/google/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.driveConfigured) setDriveConfigured(true);
        if (data?.keepEnvConfigured) setKeepEnvConfigured(true);
        if (data?.keepSession?.email) setKeepSessionEmail(data.keepSession.email);
        if (typeof window !== 'undefined' && window.location.search.includes('google_connected=1')) {
          setIsGoogleImportOpen(true);
          setIsChatOpen(true);
          window.history.replaceState({}, '', window.location.pathname);
        }
      })
      .catch(() => {
        /* offline / pre-server */
      });
  }, []);

  // Board sections list for spatial zoning
  const boardSections = useMemo(() => {
    return (currentBoard?.cards || []).filter((c) => c.type === 'section');
  }, [currentBoard?.cards]);

  // Mobile-adaptive framing: Guarantees zero white-space voids on phones while maintaining scope
  const fitWholeSurfaceScope = useCallback((board: Whiteboard, targetSectionIndex?: number) => {
    if (!board || !board.cards.length) return;

    const winW = window.innerWidth - (isSidebarOpen ? 260 : 0) - (isChatOpen ? 340 : 0);
    const winH = window.innerHeight - 50;
    const isMobile = window.innerWidth < 768;

    const sections = board.cards.filter((c) => c.type === 'section');

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    board.cards.forEach((c) => {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + c.width);
      maxY = Math.max(maxY, c.y + c.height);
    });

    const totalBoardW = maxX - minX;

    // 1. MOBILE DEVICE BEHAVIOR:
    // Never zoom down to 0.15-0.20 where cards become microscopic specks lost in empty white space!
    if (isMobile) {
      // Case A: Board is already in a vertical mobile stack (narrow width <= 550px)
      if (totalBoardW <= 550) {
        const targetScale = Math.min(1.0, Math.max(0.75, (winW - 24) / (totalBoardW + 20)));
        const targetPanX = Math.round(winW / 2 - (minX + totalBoardW / 2) * targetScale);
        const targetPanY = 35; // clean top margin

        setViewState({
          panX: targetPanX,
          panY: targetPanY,
          zoom: Number(targetScale.toFixed(3)),
        });
        return;
      }

      // Case B: Board is a wide landscape whiteboard.
      // Frame the targeted zone/section so cards occupy 85-92% of screen width with zero dead space!
      const secIdx = typeof targetSectionIndex === 'number' 
        ? targetSectionIndex 
        : Math.min(activeSectionIndex, Math.max(0, sections.length - 1));
      const targetSec = sections[secIdx] || sections[0];

      if (targetSec) {
        // A section is ~680px wide. Scale ~0.52-0.65 makes it fill the phone width edge-to-edge
        const secPadding = 20;
        const targetScale = Math.min(1.0, Math.max(0.55, (winW - 20) / (targetSec.width + secPadding)));
        const secCenterX = targetSec.x + targetSec.width / 2;
        const targetPanX = Math.round(winW / 2 - secCenterX * targetScale);
        const targetPanY = Math.round(35 - targetSec.y * targetScale);

        setViewState({
          panX: targetPanX,
          panY: targetPanY,
          zoom: Number(targetScale.toFixed(3)),
        });
        return;
      }

      // Case C: No sections found - frame the first cards cluster with safe minimum zoom
      const firstCards = board.cards.slice(0, 4);
      let cMinX = Infinity, cMaxX = -Infinity, cMinY = Infinity;
      firstCards.forEach((c) => {
        cMinX = Math.min(cMinX, c.x);
        cMaxX = Math.max(cMaxX, c.x + c.width);
        cMinY = Math.min(cMinY, c.y);
      });
      const targetScale = Math.min(1.0, Math.max(0.68, (winW - 32) / (cMaxX - cMinX + 30)));
      setViewState({
        panX: Math.round(winW / 2 - ((cMinX + cMaxX) / 2) * targetScale),
        panY: Math.round(35 - cMinY * targetScale),
        zoom: Number(targetScale.toFixed(3)),
      });
      return;
    }

    // 2. DESKTOP BEHAVIOR:
    const padding = 80;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;

    // Minimum zoom guard of 0.32 prevents outlier cards from turning the canvas into an ocean of whitespace
    const scale = Math.min(1.0, Math.max(0.32, Math.min(winW / contentW, winH / contentH)));
    const targetPanX = winW / 2 - (minX + (maxX - minX) / 2) * scale;
    const targetPanY = winH / 2 - (minY + (maxY - minY) / 2) * scale;

    setViewState({
      panX: Math.round(targetPanX),
      panY: Math.round(targetPanY),
      zoom: Number(scale.toFixed(3)),
    });
  }, [isSidebarOpen, isChatOpen, activeSectionIndex]);

  // Keyboard shortcut 'F' for Auto Focus whole layout
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInput =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable;
      if (isInput) return;

      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        fitWholeSurfaceScope(currentBoard);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentBoard, fitWholeSurfaceScope]);

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

  // Add new compact sortable Data Grid
  const handleAddNewDataGrid = () => {
    const winW = window.innerWidth - (isSidebarOpen ? 260 : 0);
    const winH = window.innerHeight - 50;
    const worldX = (winW / 2 - viewState.panX) / viewState.zoom - 220;
    const worldY = (winH / 2 - viewState.panY) / viewState.zoom - 125;

    const existingGrids = currentBoard.cards.filter((c) => c.type === 'datagrid').length;
    const newCard = createDataGridCard(
      existingGrids,
      Math.round(worldX),
      Math.round(worldY)
    );

    updateCurrentBoard((board) => ({
      ...board,
      cards: [...board.cards, newCard],
    }));
    setSelectedCardId(newCard.id);
  };

  // Populate scaled batch of nodes for scaling stress-testing
  const handlePopulateScaleTest = (count: number) => {
    const maxCardY = currentBoard.cards.reduce(
      (max, c) => Math.max(max, c.y + c.height),
      400
    );
    const { cards: scaledCards, connections: scaledConns } = generateScaleStressTestNodes(
      count,
      40,
      maxCardY + 80
    );

    updateCurrentBoard((board) => ({
      ...board,
      cards: [...board.cards, ...scaledCards],
      connections: [...board.connections, ...scaledConns],
    }));

    // Auto-fit to the whole expanded canvas
    setTimeout(() => {
      fitWholeSurfaceScope({
        ...currentBoard,
        cards: [...currentBoard.cards, ...scaledCards],
      });
    }, 150);
  };

  // Apply graph layout algorithm (Force-Directed, Stress Majorization, ELK Layered, Orthogonal, Compact Grid, Mobile Stack)
  const handleApplyLayout = useCallback((algo: GraphLayoutAlgorithm) => {
    if (!currentBoard || currentBoard.cards.length === 0) return;

    if (algo === 'mobile-stack') {
      setIsMobileStackActive(true);
    } else {
      setIsMobileStackActive(false);
    }

    const arrangedCards = applyGraphLayout(
      currentBoard.cards,
      currentBoard.connections,
      algo,
      {
        tightness: layoutTightness,
        direction: 'horizontal',
        startX: algo === 'mobile-stack' ? 20 : 60,
        startY: algo === 'mobile-stack' ? 40 : 60,
      }
    );

    updateCurrentBoard((board) => ({
      ...board,
      cards: arrangedCards,
    }));

    // Auto-fit to newly packed layout without white space void
    setTimeout(() => {
      fitWholeSurfaceScope({
        ...currentBoard,
        cards: arrangedCards,
      });
    }, 60);
  }, [currentBoard, layoutTightness, updateCurrentBoard, fitWholeSurfaceScope]);

  // Mobile Zone Carousel Navigation Handlers
  const handleSelectSection = useCallback((index: number) => {
    setActiveSectionIndex(index);
    fitWholeSurfaceScope(currentBoard, index);
  }, [currentBoard, fitWholeSurfaceScope]);

  const handleToggleMobileStack = useCallback(() => {
    if (isMobileStackActive) {
      handleApplyLayout('force-directed');
    } else {
      handleApplyLayout('mobile-stack');
    }
  }, [isMobileStackActive, handleApplyLayout]);

  const handleFocusCurrentSection = useCallback(() => {
    fitWholeSurfaceScope(currentBoard, activeSectionIndex);
  }, [currentBoard, activeSectionIndex, fitWholeSurfaceScope]);

  // Auto arrange all cards into tidy grid
  const handleAutoArrange = () => {
    handleApplyLayout('force-directed');
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

  const handleGoogleImportCommit = useCallback(
    (payload: GoogleImportCommitPayload) => {
      const winW = window.innerWidth - (isSidebarOpen ? 260 : 0);
      const winH = window.innerHeight - 50;
      const worldX = (winW / 2 - viewState.panX) / viewState.zoom - 180;
      const worldY = (winH / 2 - viewState.panY) / viewState.zoom - 120;

      const placement = placeOrganizedNotesOnCanvas(
        payload.notes,
        payload.organization,
        worldX,
        worldY
      );

      if (payload.createNewBoard) {
        const newBoardId = 'wb-google-' + Date.now();
        const newBoard: Whiteboard = {
          id: newBoardId,
          name: payload.boardName,
          description: payload.organization.overview.slice(0, 180),
          cards: placement.cards,
          connections: placement.connections,
          viewState: { panX: 20, panY: 20, zoom: 0.55 },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setWhiteboards((prev) => [...prev, newBoard]);
        setCurrentBoardId(newBoardId);
        setViewState({ panX: 20, panY: 20, zoom: 0.55 });
        if (placement.overviewCardId) {
          setSelectedCardId(placement.overviewCardId);
          setSpotlightCardId(placement.overviewCardId);
        }
      } else {
        handleAddMultipleCardsAndConnections(placement.cards, placement.connections);
        if (placement.overviewCardId) {
          setSelectedCardId(placement.overviewCardId);
          setSpotlightCardId(placement.overviewCardId);
        }
      }

      setIsGoogleImportOpen(false);
      setIsChatOpen(true);
    },
    [
      handleAddMultipleCardsAndConnections,
      isSidebarOpen,
      viewState.panX,
      viewState.panY,
      viewState.zoom,
    ]
  );

  return (
    <div
      className={`flex h-screen w-screen overflow-hidden font-sans antialiased ${
        theme === 'hepta-dark'
          ? 'bg-[#08090d] text-zinc-100'
          : theme === 'dark'
            ? 'bg-[#0c0d10] text-zinc-100'
            : 'bg-white text-zinc-900'
      }`}
    >
      
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
          onAddNewDataGrid={handleAddNewDataGrid}
          onOpenDataGridMatrix={() => setIsDataGridMatrixOpen(true)}
          onPopulateScaleTest={handlePopulateScaleTest}
          totalCardsCount={currentBoard.cards.length}
          onTriggerFileUpload={() => setIsUploadModalOpen(true)}
          onTriggerGoogleImport={() => setIsGoogleImportOpen(true)}
          onAutoArrange={handleAutoArrange}
          onApplyLayout={handleApplyLayout}
          layoutTightness={layoutTightness}
          onChangeTightness={setLayoutTightness}
          edgeRoutingMode={edgeRoutingMode}
          onChangeEdgeRouting={setEdgeRoutingMode}
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
              edgeRoutingMode={edgeRoutingMode}
              onPredictiveAction={handlePredictiveAction}
            />

            {/* Mobile Adaptive Zone Carousel & Stack Controller (Guarantees zero whitespace on phones) */}
            <MobileSectionNav
              sections={boardSections}
              currentSectionIndex={activeSectionIndex}
              onSelectSection={handleSelectSection}
              isMobileStackActive={isMobileStackActive}
              onToggleMobileStack={handleToggleMobileStack}
              onFocusCurrentSection={handleFocusCurrentSection}
              totalCards={currentBoard.cards.length}
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

      <GoogleImportModal
        isOpen={isGoogleImportOpen}
        onClose={() => setIsGoogleImportOpen(false)}
        onCommit={handleGoogleImportCommit}
        driveConfigured={driveConfigured}
        keepEnvConfigured={keepEnvConfigured}
        keepSessionEmail={keepSessionEmail}
      />

      {/* Graph Native Search Modal */}
      <GraphNativeSearch
        isOpen={isGraphSearchOpen}
        onClose={() => setIsGraphSearchOpen(false)}
        cards={currentBoard.cards}
        connections={currentBoard.connections}
        onFocusCard={handleZoomToCard}
      />

      {/* Workspace Data Grid Matrix Modal */}
      <WorkspaceDataGridModal
        isOpen={isDataGridMatrixOpen}
        onClose={() => setIsDataGridMatrixOpen(false)}
        cards={currentBoard.cards}
        connections={currentBoard.connections}
        onZoomToCard={handleZoomToCard}
        onDeleteCard={handleDeleteCard}
      />
    </div>
  );
}
