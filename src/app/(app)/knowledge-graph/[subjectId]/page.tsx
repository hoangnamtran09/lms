"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Loader2, AlertCircle, Brain, ArrowLeft } from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  mastery: string;
  description: string;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

interface GraphResult {
  centralTopic: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const masteryColors: Record<string, { bg: string; border: string; text: string }> = {
  weak: { bg: "rgba(254,226,226,0.9)", border: "#ef4444", text: "#991b1b" },
  learning: { bg: "rgba(219,234,254,0.9)", border: "#3b82f6", text: "#1e40af" },
  mastered: { bg: "rgba(220,252,231,0.9)", border: "#22c55e", text: "#166534" },
};

function computeGraphLayout(result: GraphResult) {
  // Build adjacency for depth calculation
  const childrenMap: Record<string, string[]> = {};
  const parentMap: Record<string, string> = {};
  for (const e of result.edges) {
    if (!childrenMap[e.source]) childrenMap[e.source] = [];
    childrenMap[e.source].push(e.target);
    parentMap[e.target] = e.source;
  }

  // Calculate depth from central node (or any root)
  const depthMap: Record<string, number> = {};
  function calcDepth(id: string, visited: Set<string>) {
    if (visited.has(id)) return;
    visited.add(id);
    const parent = parentMap[id];
    if (parent && depthMap[parent] === undefined) {
      calcDepth(parent, visited);
    }
    depthMap[id] = parent ? (depthMap[parent] ?? 0) + 1 : 0;
    for (const child of (childrenMap[id] || [])) {
      calcDepth(child, visited);
    }
  }
  // Start from nodes that have no parent (roots) or from all unvisited
  for (const n of result.nodes) {
    if (!parentMap[n.id]) calcDepth(n.id, new Set());
  }
  // Fill any remaining
  for (const n of result.nodes) {
    if (depthMap[n.id] === undefined) depthMap[n.id] = 0;
  }

  // Group nodes by depth
  const depthGroups: Record<number, GraphNode[]> = {};
  for (const n of result.nodes) {
    const d = depthMap[n.id] ?? 0;
    if (!depthGroups[d]) depthGroups[d] = [];
    depthGroups[d].push(n);
  }

  const maxDepth = Math.max(...Object.keys(depthGroups).map(Number), 0);

  // Layered radial layout
  const centerX = 550;
  const centerY = 400;
  const nodePositions: Record<string, { x: number; y: number }> = {};

  for (let depth = 0; depth <= maxDepth; depth++) {
    const group = depthGroups[depth] || [];
    const radius = depth === 0 ? 0 : 180 + depth * 160;
    group.forEach((n, i) => {
      const angleCount = group.length;
      const baseAngle = (depth * 0.5); // slight rotation per layer
      const angle = baseAngle + (i / angleCount) * 2 * Math.PI;
      nodePositions[n.id] = {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    });
  }

  // Build React Flow nodes
  const rfNodes: Node[] = result.nodes.map((n) => {
    const pos = nodePositions[n.id] || { x: centerX, y: centerY };
    const colors = masteryColors[n.mastery] || masteryColors.mastered;
    const isConcept = n.type === "concept";

    return {
      id: n.id,
      position: pos,
      data: { label: n.label, mastery: n.mastery, type: n.type },
      style: {
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: isConcept ? "14px" : "10px",
        padding: isConcept ? "12px 18px" : "8px 14px",
        fontSize: isConcept ? "13px" : "11px",
        fontWeight: isConcept ? 700 : 500,
        color: colors.text,
        maxWidth: 180,
        textAlign: "center" as const,
      },
    };
  });

  // Build edges
  const rfEdges: Edge[] = result.edges.map((e, i) => ({
    id: `e${i}`,
    source: e.source,
    target: e.target,
    label: e.label || undefined,
    type: "smoothstep",
    style: { stroke: "#cbd5e1", strokeWidth: 1.5 },
    labelStyle: { fontSize: 10, fill: "#94a3b8" },
    labelBgStyle: { fill: "#fff", fillOpacity: 0.9 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#cbd5e1", width: 12, height: 12 },
    pathOptions: { borderRadius: 15 },
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

export default function KnowledgeGraphPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = use(params);
  const [result, setResult] = useState<GraphResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    async function fetchGraph() {
      try {
        const data = await api<GraphResult>("/api/ai/knowledge-graph", {
          method: "POST",
          body: JSON.stringify({ subjectId }),
        });
        setResult(data);
        const { nodes: rfNodes, edges: rfEdges } = computeGraphLayout(data);
        setNodes(rfNodes);
        setEdges(rfEdges);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Không thể tạo sơ đồ tri thức");
      } finally {
        setLoading(false);
      }
    }
    fetchGraph();
  }, [subjectId, setEdges, setNodes]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="size-8 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-500">Đang tạo sơ đồ tri thức...</p>
        <p className="text-sm text-gray-400 mt-1">AI đang phân tích toàn bộ môn học</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-20">
        <AlertCircle className="size-16 text-red-200 mb-5" />
        <p className="text-lg font-semibold text-gray-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!result || result.nodes.length === 0) {
    return (
      <div className="text-center py-20">
        <Brain className="size-16 text-gray-200 mx-auto mb-5" />
        <p className="text-lg font-semibold text-gray-500">Không thể tạo sơ đồ tri thức cho môn học này</p>
        <p className="text-sm text-gray-400 mt-1">Môn học cần có nhiều bài học hơn để tạo đồ thị</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/mindmap" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-1">
            <ArrowLeft className="size-3" />
            Quay lại
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{result.centralTopic}</h1>
          <p className="text-sm text-gray-500">
            {result.nodes.length} khái niệm · {result.edges.length} liên kết · AI tạo
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-red-500" /> Yếu
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-blue-500" /> Đang học
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-green-500" /> Thành thạo
          </span>
        </div>
      </div>

      <div className="h-[650px] rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-violet-50/30 overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => setSelectedNode(result.nodes.find((n) => n.id === node.id) || null)}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          attributionPosition="bottom-right"
          nodesDraggable={false}
        >
          <Background color="#e2e8f0" gap={30} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const m = n.data?.mastery as string;
              return m === "weak" ? "#ef4444" : m === "learning" ? "#3b82f6" : "#22c55e";
            }}
            style={{ background: "#f8fafc", borderRadius: "8px" }}
          />
        </ReactFlow>
      </div>

      {selectedNode && (
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`size-2.5 rounded-full ${
                selectedNode.mastery === "weak"
                  ? "bg-red-500"
                  : selectedNode.mastery === "learning"
                  ? "bg-blue-500"
                  : "bg-green-500"
              }`}
            />
            <h3 className="font-semibold text-gray-900">{selectedNode.label}</h3>
            <span className="text-xs text-gray-400 px-2 py-0.5 rounded-full bg-gray-100">
              {selectedNode.type === "concept" ? "Khái niệm" : selectedNode.type === "subtopic" ? "Chủ đề" : "Chi tiết"}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {selectedNode.description ||
              (selectedNode.mastery === "weak"
                ? "Bạn đang gặp khó khăn với khái niệm này. Hãy ôn tập thêm."
                : selectedNode.mastery === "learning"
                ? "Bạn đang trong quá trình học khái niệm này."
                : "Bạn đã nắm vững khái niệm này.")}
          </p>
        </div>
      )}
    </div>
  );
}
