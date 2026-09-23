import { SurfaceCard, Connection, CardColor, CardType, DataGridData } from '../types/surface';

// Realistic sample presets for compact data grids
export const SAMPLE_DATA_GRIDS: { title: string; color: CardColor; data: DataGridData; tags: string[] }[] = [
  {
    title: 'Global Edge CDN Fleet Status',
    color: 'orange',
    tags: ['CDN', 'TELEMETRY', 'EDGE'],
    data: {
      columns: [
        { id: 'pop', header: 'POP Code', type: 'text', sortable: true },
        { id: 'region', header: 'Region', type: 'text', sortable: true },
        { id: 'status', header: 'Status', type: 'status', sortable: true },
        { id: 'p99', header: 'P99 Latency', type: 'number', sortable: true },
        { id: 'qps', header: 'QPS', type: 'number', sortable: true },
        { id: 'cache_hit', header: 'Cache Hit %', type: 'number', sortable: true },
      ],
      rows: [
        { pop: 'SIN-01', region: 'Singapore', status: 'Healthy', p99: '1.2ms', qps: '124,000', cache_hit: '99.4%' },
        { pop: 'TYO-03', region: 'Tokyo', status: 'Healthy', p99: '1.8ms', qps: '98,500', cache_hit: '99.1%' },
        { pop: 'FRA-02', region: 'Frankfurt', status: 'Healthy', p99: '2.1ms', qps: '142,300', cache_hit: '98.9%' },
        { pop: 'LHR-01', region: 'London', status: 'Degraded', p99: '6.4ms', qps: '89,200', cache_hit: '94.2%' },
        { pop: 'SJC-04', region: 'San Jose', status: 'Healthy', p99: '0.9ms', qps: '185,000', cache_hit: '99.6%' },
        { pop: 'IAD-02', region: 'Ashburn', status: 'Healthy', p99: '1.1ms', qps: '210,000', cache_hit: '99.7%' },
        { pop: 'SYD-01', region: 'Sydney', status: 'Healthy', p99: '3.4ms', qps: '45,800', cache_hit: '98.5%' },
        { pop: 'GRU-01', region: 'São Paulo', status: 'Degraded', p99: '8.2ms', qps: '38,100', cache_hit: '93.7%' },
      ],
    },
  },
  {
    title: 'Microservice Health & SLA SLI Audit',
    color: 'green',
    tags: ['SERVICES', 'SLA', 'OBSERVABILITY'],
    data: {
      columns: [
        { id: 'svc', header: 'Service', type: 'text', sortable: true },
        { id: 'tier', header: 'Tier', type: 'text', sortable: true },
        { id: 'replicas', header: 'Replicas', type: 'number', sortable: true },
        { id: 'error_rate', header: 'Error Rate', type: 'number', sortable: true },
        { id: 'p99_resp', header: 'P99 Resp', type: 'number', sortable: true },
        { id: 'health', header: 'Health', type: 'status', sortable: true },
      ],
      rows: [
        { svc: 'auth-gateway', tier: 'Tier-0', replicas: 32, error_rate: '0.001%', p99_resp: '2.8ms', health: 'Healthy' },
        { svc: 'session-store', tier: 'Tier-0', replicas: 48, error_rate: '0.000%', p99_resp: '1.1ms', health: 'Healthy' },
        { svc: 'graph-indexer', tier: 'Tier-1', replicas: 16, error_rate: '0.042%', p99_resp: '14.5ms', health: 'Healthy' },
        { svc: 'event-stream', tier: 'Tier-0', replicas: 64, error_rate: '0.002%', p99_resp: '4.2ms', health: 'Healthy' },
        { svc: 'vector-search', tier: 'Tier-1', replicas: 24, error_rate: '0.120%', p99_resp: '28.4ms', health: 'Degraded' },
        { svc: 'audit-log-sink', tier: 'Tier-2', replicas: 8, error_rate: '0.005%', p99_resp: '8.9ms', health: 'Healthy' },
        { svc: 'push-notifier', tier: 'Tier-2', replicas: 12, error_rate: '0.018%', p99_resp: '12.0ms', health: 'Healthy' },
      ],
    },
  },
  {
    title: 'Database Shard Cluster Metrics',
    color: 'blue',
    tags: ['DATABASE', 'STORAGE', 'SHARDING'],
    data: {
      columns: [
        { id: 'shard', header: 'Shard ID', type: 'text', sortable: true },
        { id: 'leader', header: 'Leader Node', type: 'text', sortable: true },
        { id: 'keys', header: 'Total Keys', type: 'number', sortable: true },
        { id: 'ram', header: 'RAM Util', type: 'number', sortable: true },
        { id: 'iops', header: 'Write IOPS', type: 'number', sortable: true },
        { id: 'lag', header: 'Replica Lag', type: 'number', sortable: true },
        { id: 'status', header: 'Status', type: 'status', sortable: true },
      ],
      rows: [
        { shard: 'shard-001', leader: 'node-us-west-a', keys: '4.8M', ram: '68.4%', iops: '14,200', lag: '0.4ms', status: 'Healthy' },
        { shard: 'shard-002', leader: 'node-us-west-b', keys: '5.1M', ram: '72.1%', iops: '15,800', lag: '0.6ms', status: 'Healthy' },
        { shard: 'shard-003', leader: 'node-eu-west-a', keys: '4.2M', ram: '59.0%', iops: '11,400', lag: '0.5ms', status: 'Healthy' },
        { shard: 'shard-004', leader: 'node-ap-east-a', keys: '6.4M', ram: '88.9%', iops: '21,900', lag: '2.8ms', status: 'Degraded' },
        { shard: 'shard-005', leader: 'node-sa-east-a', keys: '3.1M', ram: '42.2%', iops: '7,600', lag: '0.8ms', status: 'Healthy' },
      ],
    },
  },
  {
    title: 'Security Vulnerability & Incident Log',
    color: 'red',
    tags: ['SECURITY', 'COMPLIANCE', 'AUDIT'],
    data: {
      columns: [
        { id: 'cve', header: 'Vulnerability / CVE', type: 'text', sortable: true },
        { id: 'component', header: 'Component', type: 'text', sortable: true },
        { id: 'severity', header: 'Severity', type: 'status', sortable: true },
        { id: 'status', header: 'Mitigation Status', type: 'status', sortable: true },
        { id: 'sla_days', header: 'SLA Remaining', type: 'number', sortable: true },
      ],
      rows: [
        { cve: 'CVE-2026-3910', component: 'lib-tls-handshake', severity: 'Critical', status: 'Offline', sla_days: '1 day' },
        { cve: 'CVE-2026-1142', component: 'jwt-auth-verifier', severity: 'High', status: 'Degraded', sla_days: '3 days' },
        { cve: 'CVE-2025-8821', component: 'redis-client-v7', severity: 'Warning', status: 'Healthy', sla_days: '14 days' },
        { cve: 'CVE-2025-6701', component: 'grpc-compression', severity: 'Healthy', status: 'Healthy', sla_days: 'Resolved' },
      ],
    },
  },
];

// Helper to create a standalone Data Grid card
export function createDataGridCard(
  presetIndex = 0,
  x = 100,
  y = 100
): SurfaceCard {
  const preset = SAMPLE_DATA_GRIDS[presetIndex % SAMPLE_DATA_GRIDS.length];
  const id = `card-grid-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  return {
    id,
    type: 'datagrid',
    title: preset.title,
    content: `Compact tabular dataset with sortable headers, instant query filters, and inline cell editing.`,
    x,
    y,
    width: 440,
    height: 250,
    color: preset.color,
    tags: [...preset.tags, 'DATAGRID'],
    dataGridData: JSON.parse(JSON.stringify(preset.data)),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Generate scaled collections of cards (e.g. 20, 50, 100 cards) for scale stress-testing
export function generateScaleStressTestNodes(
  count: number,
  startX = 120,
  startY = 850
): { cards: SurfaceCard[]; connections: Connection[] } {
  const cards: SurfaceCard[] = [];
  const connections: Connection[] = [];

  const types: CardType[] = ['datagrid', 'note', 'code', 'table', 'pdf'];
  const colors: CardColor[] = ['blue', 'green', 'orange', 'purple', 'yellow', 'red', 'gray'];

  const services = [
    'payment-router', 'order-processor', 'inventory-syncer', 'checkout-orchestrator',
    'notification-dispatcher', 'recommendation-worker', 'fraud-evaluator', 'pricing-engine',
    'metrics-ingestor', 'search-indexer', 'auth-session-manager', 'blob-storage-proxy',
    'cdn-edge-director', 'rate-limiter-redis', 'graph-relational-sync', 'audit-trail-logger',
    'webhook-subscriber', 'event-bus-kafka', 'token-vault', 'ml-inference-cluster',
    'distributed-lock-consul', 'grpc-load-balancer', 'dns-health-checker', 'billing-ledger'
  ];

  const cols = 5;
  const cardW = 300;
  const cardH = 200;
  const gapX = 40;
  const gapY = 40;

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    const svcName = services[i % services.length];
    const uniqueSuffix = Math.floor(i / services.length) > 0 ? `-${Math.floor(i / services.length)}` : '';
    const nodeName = `${svcName}${uniqueSuffix}`;

    const type = types[i % types.length];
    const color = colors[i % colors.length];
    const cardId = `node-scale-${i + 1}-${Date.now().toString(36)}`;

    let card: SurfaceCard;

    if (type === 'datagrid') {
      const preset = SAMPLE_DATA_GRIDS[i % SAMPLE_DATA_GRIDS.length];
      card = {
        id: cardId,
        type: 'datagrid',
        title: `${nodeName} Metrics`,
        content: `Live telemetry and metric matrix for ${nodeName}.`,
        x,
        y,
        width: 340,
        height: 220,
        color,
        tags: [nodeName.toUpperCase(), 'DATAGRID', 'SCALE'],
        dataGridData: JSON.parse(JSON.stringify(preset.data)),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    } else if (type === 'code') {
      card = {
        id: cardId,
        type: 'code',
        title: `${nodeName}-service.ts`,
        content: `export async function handle${nodeName.replace(/-/g, '')}(req: Request): Promise<Response> {\n  const startTime = performance.now();\n  const payload = await req.json();\n  const res = await processInternal(payload);\n  trackLatency('${nodeName}', performance.now() - startTime);\n  return Response.json(res);\n}`,
        x,
        y,
        width: cardW,
        height: cardH,
        color,
        tags: [nodeName.toUpperCase(), 'CODE', 'MICROSERVICE'],
        codeLanguage: 'typescript',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    } else if (type === 'table') {
      card = {
        id: cardId,
        type: 'table',
        title: `${nodeName}_slis.csv`,
        content: `SLI and SLA measurements for ${nodeName}.`,
        x,
        y,
        width: cardW,
        height: cardH,
        color,
        tags: [nodeName.toUpperCase(), 'TABLE', 'SLI'],
        tableData: {
          headers: ['Metric', 'Target', 'Actual', 'Status'],
          rows: [
            ['P95 Latency', '< 5.0ms', `${(1.2 + (i % 5) * 0.8).toFixed(1)}ms`, 'Healthy'],
            ['Availability', '99.95%', `${(99.98 - (i % 4) * 0.02).toFixed(2)}%`, 'Healthy'],
            ['Throughput', '> 5k req/s', `${8000 + (i * 250)}/s`, 'Healthy'],
          ],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    } else if (type === 'pdf') {
      card = {
        id: cardId,
        type: 'pdf',
        title: `${nodeName}_RFC_Spec.pdf`,
        content: `RFC Specification Document: ${nodeName}\nVersion: 2.${i + 1}\n\nAbstract: Core design parameters, circuit breakers, and retry backoff thresholds for high-concurrency event stream ingestion.`,
        x,
        y,
        width: cardW,
        height: cardH,
        color,
        tags: [nodeName.toUpperCase(), 'SPEC', 'RFC'],
        fileMetadata: {
          name: `${nodeName}_RFC_Spec.pdf`,
          size: 1450000 + i * 20000,
          mimeType: 'application/pdf',
          pageCount: 6 + (i % 8),
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    } else {
      card = {
        id: cardId,
        type: 'note',
        title: `${nodeName} Topology`,
        content: `### Microservice Architecture: ${nodeName}\n- **Partition Key:** \`tenant_id:region_${(i % 3) + 1}\`\n- **Consensus Role:** Follower / Read Replica\n- **Rate Limit:** ${10000 + i * 500} tokens/sec\n\n*Health status verified by ambient supervisor.*`,
        x,
        y,
        width: cardW,
        height: cardH,
        color,
        tags: [nodeName.toUpperCase(), 'TOPOLOGY', 'NODE'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    cards.push(card);

    // Create interconnected relations between adjacent cards
    if (i > 0 && Math.random() > 0.3) {
      const prevId = cards[i - 1].id;
      connections.push({
        id: `scale-conn-${i}-${Date.now().toString(36)}`,
        fromId: prevId,
        toId: cardId,
        label: i % 3 === 0 ? 'depends_on' : i % 3 === 1 ? 'telemetry' : 'routes_to',
        color: '#64748b',
        style: i % 2 === 0 ? 'solid' : 'dashed',
      });
    }

    // Inter-row connection
    if (row > 0 && Math.random() > 0.5) {
      const upperIndex = i - cols;
      if (cards[upperIndex]) {
        connections.push({
          id: `scale-conn-row-${i}-${Date.now().toString(36)}`,
          fromId: cards[upperIndex].id,
          toId: cardId,
          label: 'syncs_with',
          color: '#3b82f6',
          style: 'solid',
        });
      }
    }
  }

  return { cards, connections };
}
