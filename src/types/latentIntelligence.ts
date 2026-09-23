import { SurfaceCard, Connection } from './surface';

// Semantic relationship types
export type SemanticRelationType = 
  | 'supports'
  | 'contradicts'
  | 'causes'
  | 'depends_on'
  | 'derived_from'
  | 'supersedes'
  | 'telemetry'
  | 'peering'
  | 'spec_impl'
  | 'related';

// Extended connection with semantic attributes and visual strength
export interface SemanticConnection extends Connection {
  semanticType?: SemanticRelationType;
  strength?: number; // 0.1 to 1.0 (controls line weight, opacity, tension)
  confidence?: number; // 0.1 to 1.0
  sourceSnippet?: string; // Evidence anchor
  notes?: string;
  isAiProposed?: boolean; // ambient AI suggestion
}

// Computational Views supported by the latent engine
export type ComputationalViewMode = 
  | 'whiteboard'
  | 'graph'
  | 'timeline'
  | 'dependency'
  | 'arguments'
  | 'evidence'
  | 'matrix';

// Semantic Zoom Level: territories (farthest) -> themes -> clusters -> cards -> content -> evidence (closest)
export type SemanticZoomLevel = 
  | 'territories' // zoom < 0.35
  | 'themes'      // 0.35 <= zoom < 0.55
  | 'clusters'    // 0.55 <= zoom < 0.75
  | 'cards'       // 0.75 <= zoom < 1.15
  | 'content'     // 1.15 <= zoom < 1.6
  | 'evidence';   // zoom >= 1.6

// Contradiction or Inconsistency detected in knowledge base
export interface DetectedContradiction {
  id: string;
  cardAId: string;
  cardBId: string;
  claimA: string;
  claimB: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  resolved?: boolean;
}

// Evidence Provenance Trace
export interface ProvenanceTrace {
  id: string;
  targetCardId: string;
  claim: string;
  evidenceCardIds: string[];
  confidence: number;
  derivationMethod: string; // e.g. "Direct citation", "Inference from telemetry", "Structural clustering"
}

// Latent Intelligence State (the computational layer beneath the visible canvas)
export interface LatentEngineState {
  isLatentLayerActive: boolean; // "Show me what I'm not seeing" toggle
  territoryClusters: LatentTerritory[];
  contradictions: DetectedContradiction[];
  provenanceTraces: ProvenanceTrace[];
  suggestedMissingConnections: SemanticConnection[];
  unsupportedClaims: { cardId: string; claim: string; suggestedSearch: string }[];
  activeViewMode: ComputationalViewMode;
  timelineScrubTimestamp: number; // For temporal scrub slider (0 to 100%)
  dynamicGroupingCriterion: 'none' | 'ontology' | 'confidence' | 'source' | 'time' | 'contradiction';
}

// Conceptual territory computed from spatial proximity and semantic embedding
export interface LatentTerritory {
  id: string;
  title: string;
  theme: string;
  cardIds: string[];
  centroidX: number;
  centroidY: number;
  radius: number;
  color: string;
  density: number;
  summary: string;
}

// Snapshot for State History (branching, restoring, comparing)
export interface WorkspaceSnapshot {
  id: string;
  label: string;
  timestamp: number;
  cardsCount: number;
  connectionsCount: number;
  snapshotData: {
    cards: SurfaceCard[];
    connections: Connection[];
  };
}
