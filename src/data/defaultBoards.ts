import { Whiteboard } from '../types/surface';

export const INITIAL_WHITEBOARDS: Whiteboard[] = [
  {
    id: 'wb-distributed-sys',
    name: 'Distributed Systems Architecture',
    description: 'High-throughput caching topologies, consensus specifications, and telemetry benchmarks.',
    viewState: {
      panX: 40,
      panY: 30,
      zoom: 0.72,
    },
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 1800000,
    cards: [
      // ONTOLOGY GROUP 1: Architecture & System Topology (Blue Ontology)
      {
        id: 'sec-arch',
        type: 'section',
        title: 'Architecture & System Topology',
        content: 'Core backend topology, RPC interfaces, and cache replication pipelines.',
        x: 40,
        y: 40,
        width: 580,
        height: 390,
        color: 'blue',
        tags: ['SYSTEM', 'SPECS'],
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },
      {
        id: 'card-arch-pdf',
        type: 'pdf',
        title: 'Distributed_Cache_Spec_v3.pdf',
        content: `PDF Document: Distributed_Cache_Spec_v3.pdf\nPages: 14 pages • Infrastructure Engineering\n\nAbstract: High-throughput multi-region cache replication with sub-5ms read latency across Singapore, Tokyo, and Frankfurt. Utilizes Raft consensus for topology changes and gossip protocol for invalidations.`,
        x: 60,
        y: 90,
        width: 260,
        height: 180,
        color: 'blue',
        tags: ['PDF', 'RFC', 'CACHE'],
        sectionId: 'sec-arch',
        fileMetadata: {
          name: 'Distributed_Cache_Spec_v3.pdf',
          size: 2450000,
          mimeType: 'application/pdf',
          pageCount: 14,
        },
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },
      {
        id: 'card-code-cache',
        type: 'code',
        title: 'cache-replicator.ts',
        content: `export async function syncDirtyPages(
  peers: NodeCluster[],
  dirtyBlocks: MemoryBlock[]
): Promise<SyncResult> {
  const batch = prepareGossipEnvelope(dirtyBlocks);
  const quorum = Math.floor(peers.length / 2) + 1;
  const acks = await Promise.allSettled(
    peers.map(p => p.sendRpc('CACHE_SYNC', batch, { timeoutMs: 250 }))
  );
  return {
    replicated: acks.filter(a => a.status === 'fulfilled').length >= quorum,
    timestamp: Date.now()
  };
}`,
        x: 340,
        y: 90,
        width: 260,
        height: 220,
        color: 'blue',
        tags: ['TYPESCRIPT', 'CODE'],
        codeLanguage: 'typescript',
        sectionId: 'sec-arch',
        fileMetadata: {
          name: 'cache-replicator.ts',
          size: 4200,
          mimeType: 'text/typescript',
        },
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },
      {
        id: 'card-latency-note',
        type: 'note',
        title: 'Latency Targets & SLIs',
        content: `### Service Level Objectives\n- **p99 Read Latency:** < 4.2ms across edge zones\n- **Cache Hit Ratio:** Target 98.4% for warm assets\n- **Failover Convergence:** < 850ms during leader partition\n\n*Validation:* Validate packet overhead during peak intervals.`,
        x: 60,
        y: 285,
        width: 260,
        height: 130,
        color: 'blue',
        tags: ['METRICS', 'SLO'],
        sectionId: 'sec-arch',
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },

      // ONTOLOGY GROUP 2: Surface Interaction & Viewport (Purple Ontology)
      {
        id: 'sec-design',
        type: 'section',
        title: 'Canvas Interaction & Viewport Engine',
        content: 'Surface interaction paradigms, camera panning physics, and card coordinate systems.',
        x: 640,
        y: 40,
        width: 560,
        height: 390,
        color: 'purple',
        tags: ['SYSTEM', 'CANVAS'],
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },
      {
        id: 'card-ui-mockup',
        type: 'image',
        title: 'surface-canvas-wireframe.png',
        content: 'Infinite visual whiteboard canvas layout with dense compact cards and high contrast borders.',
        x: 660,
        y: 90,
        width: 250,
        height: 180,
        color: 'purple',
        tags: ['LAYOUT'],
        sectionId: 'sec-design',
        fileMetadata: {
          name: 'surface-canvas-wireframe.png',
          size: 890000,
          mimeType: 'image/png',
          dataUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
        },
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },
      {
        id: 'card-interview-audio',
        type: 'audio',
        title: 'User_Research_Sprint_Notes.mp3',
        content: `Audio Recording: User_Research_Sprint_Notes.mp3\nDuration: 04:12\n\n1. Dense cards with high-contrast borders.\n2. Auto-zoom to whole surface on launch.\n3. Automatic ontology color coding for groups.`,
        x: 930,
        y: 90,
        width: 250,
        height: 180,
        color: 'purple',
        tags: ['AUDIO', 'LOGS'],
        sectionId: 'sec-design',
        fileMetadata: {
          name: 'User_Research_Sprint_Notes.mp3',
          size: 3800000,
          mimeType: 'audio/mpeg',
        },
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },
      {
        id: 'card-gesture-note',
        type: 'note',
        title: 'Navigation Controls & Physics',
        content: `### Surface Navigation Controls:\n- **Pan:** Space + Drag, Middle Mouse, or Drag canvas\n- **Zoom:** Mouse wheel with focal pivot, Pinch gesture\n- **Ingestion:** Direct OS file drop onto coordinates\n- **Locations:** Tap any city name (e.g. Singapore) to spawn live map`,
        x: 660,
        y: 285,
        width: 520,
        height: 130,
        color: 'purple',
        tags: ['SPEC', 'CONTROLS'],
        sectionId: 'sec-design',
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },

      // ONTOLOGY GROUP 3: Performance Telemetry & Benchmarks (Green Ontology)
      {
        id: 'sec-telemetry',
        type: 'section',
        title: 'Latency Telemetry & Regional Routing',
        content: 'Latency evaluation comparing cold cache vs warm gossip mesh across edge clusters.',
        x: 40,
        y: 450,
        width: 680,
        height: 310,
        color: 'green',
        tags: ['DATA', 'TELEMETRY'],
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },
      {
        id: 'card-metrics-table',
        type: 'table',
        title: 'Q4_Latency_Benchmarks.csv',
        content: 'Benchmark evaluation comparing cold cache vs warm gossip mesh across 4 edge clusters.',
        x: 60,
        y: 500,
        width: 390,
        height: 235,
        color: 'green',
        tags: ['DATA', 'CSV'],
        sectionId: 'sec-telemetry',
        tableData: {
          headers: ['Cluster Node', 'P50', 'P95', 'P99', 'Uptime'],
          rows: [
            ['us-west-edge-1', '1.2ms', '2.8ms', '3.9ms', '99.99%'],
            ['eu-central-1', '1.8ms', '3.1ms', '4.4ms', '99.98%'],
            ['ap-northeast-1', '1.5ms', '2.9ms', '4.1ms', '99.99%'],
            ['sa-east-edge-1', '2.1ms', '4.0ms', '5.2ms', '99.95%'],
          ]
        },
        fileMetadata: {
          name: 'Q4_Latency_Benchmarks.csv',
          size: 1240,
          mimeType: 'text/csv',
        },
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },
      {
        id: 'card-action-plan',
        type: 'note',
        title: 'Verification Milestones',
        content: `### Execution Pipeline:\n- [x] Dense card compaction & crisp borders\n- [x] Full-scope zoom out on launch\n- [x] Subtle ontology color-coding\n- [x] Tap text location (e.g. Tokyo) to generate map\n- [x] Highlight text to generate connected drill-down`,
        x: 470,
        y: 500,
        width: 230,
        height: 235,
        color: 'green',
        tags: ['TASKS'],
        sectionId: 'sec-telemetry',
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },

      // ONTOLOGY GROUP 4: Regional Node Map (Orange Ontology)
      {
        id: 'sec-geo',
        type: 'section',
        title: 'Geographic Infrastructure Presence',
        content: 'Primary intercontinental relay nodes and submarine fiber termination points.',
        x: 740,
        y: 450,
        width: 460,
        height: 310,
        color: 'orange',
        tags: ['GEO', 'NETWORK'],
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },
      {
        id: 'card-map-singapore',
        type: 'map',
        title: 'Singapore Edge Node',
        content: 'Asia-Pacific ultra-low latency routing hub and cross-strait peering exchange.',
        x: 760,
        y: 500,
        width: 420,
        height: 235,
        color: 'orange',
        tags: ['LOCATION', 'MAP'],
        sectionId: 'sec-geo',
        mapData: {
          locationName: 'Singapore Edge Node',
          latitude: 1.3521,
          longitude: 103.8198,
          zoomLevel: 12,
          placeDetails: 'Asia-Pacific ultra-low latency routing hub'
        },
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      }
    ],
    connections: [
      {
        id: 'conn-1',
        fromId: 'card-arch-pdf',
        toId: 'card-code-cache',
        label: 'spec:impl',
        color: '#64748b',
        style: 'solid'
      },
      {
        id: 'conn-2',
        fromId: 'card-code-cache',
        toId: 'card-latency-note',
        label: 'slo:bound',
        color: '#64748b',
        style: 'dashed'
      },
      {
        id: 'conn-3',
        fromId: 'card-interview-audio',
        toId: 'card-gesture-note',
        label: 'validates',
        color: '#64748b',
        style: 'solid'
      },
      {
        id: 'conn-4',
        fromId: 'card-latency-note',
        toId: 'card-metrics-table',
        label: 'telemetry',
        color: '#64748b',
        style: 'dashed'
      },
      {
        id: 'conn-5',
        fromId: 'card-metrics-table',
        toId: 'card-map-singapore',
        label: 'geo:peering',
        color: '#64748b',
        style: 'solid'
      }
    ]
  },
  {
    id: 'wb-product-roadmap',
    name: 'Platform Deployment & Research',
    description: 'User interviews, marketing collateral, competitive analysis, and file attachments.',
    viewState: {
      panX: 40,
      panY: 40,
      zoom: 0.8,
    },
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 3600000,
    cards: [
      {
        id: 'sec-research',
        type: 'section',
        title: 'Cognitive Surface Research',
        content: 'Principles of spatial knowledge organization and continuous canvas navigation.',
        x: 40,
        y: 40,
        width: 580,
        height: 280,
        color: 'purple',
        tags: ['RESEARCH'],
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },
      {
        id: 'card-market-research',
        type: 'note',
        title: 'Architectural Analysis',
        content: `Traditional note apps isolate knowledge in hierarchical directories.
Visual whiteboarding surfaces unlock spatial cognition by mapping cards, documents, and code onto an infinite coordinate grid.
With targeted focal auto-zoom, context switching latency is minimized.`,
        x: 60,
        y: 90,
        width: 270,
        height: 200,
        color: 'purple',
        tags: ['ANALYSIS', 'SPATIAL'],
        sectionId: 'sec-research',
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },
      {
        id: 'card-marketing-doc',
        type: 'pdf',
        title: 'Launch_Plan_2026.pdf',
        content: 'System deployment outline, stage gate schedules, performance baselines, and asset specs for San Francisco and New York.',
        x: 350,
        y: 90,
        width: 250,
        height: 200,
        color: 'purple',
        tags: ['PLAN', 'PDF'],
        sectionId: 'sec-research',
        fileMetadata: {
          name: 'Launch_Plan_2026.pdf',
          size: 1850000,
          mimeType: 'application/pdf',
          pageCount: 8,
        },
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      }
    ],
    connections: [
      {
        id: 'conn-g1',
        fromId: 'card-market-research',
        toId: 'card-marketing-doc',
        label: 'pipeline',
        color: '#64748b',
        style: 'solid'
      }
    ]
  }
];
