import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated buildPassiveGraph implementation to test the logic
function buildPassiveGraph(treeData, activeAllocatedHashes = new Set()) {
  const graph = {
    nodes: new Map(),
    edges: []
  };

  if (!treeData || !treeData.nodes) return graph;

  const rawNodes = treeData.nodes;

  // 1. Build Node Map
  for (const [id, rawNode] of Object.entries(rawNodes)) {
    const node = {
      id: String(id),
      x: Number(rawNode.x || 0),
      y: Number(rawNode.y || 0),
      name: rawNode.n || '',
      type: rawNode.t || 'normal',
      connections: [],
      group: rawNode.g,
      gx: rawNode.gx,
      gy: rawNode.gy,
      o: rawNode.o,
      R: rawNode.R,
      ascendancy: rawNode.a || null,
      stats: rawNode.sd || [],
      allocated: activeAllocatedHashes.has(String(id))
    };
    graph.nodes.set(id, node);
  }

  // 2. Build Connections and Edges
  const seenEdges = new Set();

  for (const [id, rawNode] of Object.entries(rawNodes)) {
    const node = graph.nodes.get(id);
    if (!node) continue;

    const conns = rawNode.co || (rawNode.c || []).map(cid => ({ id: String(cid), orbit: 0 }));

    for (const conn of conns) {
      const targetId = String(conn.id);
      const targetNode = graph.nodes.get(targetId);

      if (!targetNode) continue;

      if (!node.connections.includes(targetId)) {
        node.connections.push(targetId);
      }
      if (!targetNode.connections.includes(id)) {
        targetNode.connections.push(id);
      }

      const numSrc = Number(id);
      const numTgt = Number(targetId);
      if (numSrc === numTgt) continue;

      const edgeKey = numSrc < numTgt ? `${numSrc}-${numTgt}` : `${numTgt}-${numSrc}`;
      if (!seenEdges.has(edgeKey)) {
        seenEdges.add(edgeKey);
        
        const sNode = numSrc < numTgt ? node : targetNode;
        const tNode = numSrc < numTgt ? targetNode : node;

        graph.edges.push({
          sourceId: numSrc < numTgt ? id : targetId,
          targetId: numSrc < numTgt ? targetId : id,
          orbit: Number(conn.orbit || 0),
          isAllocated: !!(sNode.allocated && tNode.allocated)
        });
      }
    }
  }

  return graph;
}

test('Passive Tree Graph Builder - 5 nodes chain fixture', () => {
  // Test fixture: 5 nodes in a chain (1 - 2 - 3 - 4 - 5)
  const treeData = {
    nodes: {
      "1": { x: 100, y: 100, n: "Start Node", t: "start", c: ["2"] },
      "2": { x: 200, y: 100, n: "Normal Node 1", t: "normal", c: ["1", "3"] },
      "3": { x: 300, y: 100, n: "Notable Node 2", t: "notable", c: ["2", "4"] },
      "4": { x: 400, y: 100, n: "Keystone Node 3", t: "keystone", c: ["3", "5"] },
      "5": { x: 500, y: 100, n: "End Jewel Node", t: "jewel", c: ["4"] }
    }
  };

  // Case A: No nodes allocated
  const graphA = buildPassiveGraph(treeData, new Set());
  
  assert.equal(graphA.nodes.size, 5);
  assert.equal(graphA.edges.length, 4);

  // Verify alphabetical/numerical edge sorting
  assert.deepEqual(graphA.edges[0], { sourceId: "1", targetId: "2", orbit: 0, isAllocated: false });
  assert.deepEqual(graphA.edges[1], { sourceId: "2", targetId: "3", orbit: 0, isAllocated: false });
  assert.deepEqual(graphA.edges[2], { sourceId: "3", targetId: "4", orbit: 0, isAllocated: false });
  assert.deepEqual(graphA.edges[3], { sourceId: "4", targetId: "5", orbit: 0, isAllocated: false });

  // Case B: Chain allocations (1, 2, 3 allocated)
  const allocatedSet = new Set(["1", "2", "3"]);
  const graphB = buildPassiveGraph(treeData, allocatedSet);

  // Node 1, 2, 3 are allocated
  assert.equal(graphB.nodes.get("1").allocated, true);
  assert.equal(graphB.nodes.get("2").allocated, true);
  assert.equal(graphB.nodes.get("3").allocated, true);
  assert.equal(graphB.nodes.get("4").allocated, false);
  assert.equal(graphB.nodes.get("5").allocated, false);

  // Edges (1-2) and (2-3) should be allocated
  assert.equal(graphB.edges.find(e => e.sourceId === "1" && e.targetId === "2").isAllocated, true);
  assert.equal(graphB.edges.find(e => e.sourceId === "2" && e.targetId === "3").isAllocated, true);

  // Edges (3-4) and (4-5) should NOT be allocated
  assert.equal(graphB.edges.find(e => e.sourceId === "3" && e.targetId === "4").isAllocated, false);
  assert.equal(graphB.edges.find(e => e.sourceId === "4" && e.targetId === "5").isAllocated, false);
});

test('Passive tree allocation maps exact passive IDs without generating path nodes', () => {
  const treeData = {
    nodes: {
      "1": { sid: "start", n: "Start", t: "start", c: ["2"] },
      "2": { sid: "travel_a", n: "Travel A", t: "normal", c: ["1", "3"] },
      "3": { sid: "travel_b", n: "Travel B", t: "normal", c: ["2", "4"] },
      "4": { sid: "notable_target", n: "Target", t: "notable", c: ["3"] },
    }
  };
  const sidMap = Object.fromEntries(
    Object.entries(treeData.nodes).map(([hash, node]) => [node.sid, hash])
  );
  const importedPassiveIds = ["notable_target"];
  const allocatedHashes = new Set(importedPassiveIds.map((id) => sidMap[id]).filter(Boolean));

  assert.deepEqual([...allocatedHashes], ["4"]);

  const graph = buildPassiveGraph(treeData, allocatedHashes);
  assert.equal(graph.nodes.get("4").allocated, true);
  assert.equal(graph.nodes.get("2").allocated, false);
  assert.equal(graph.nodes.get("3").allocated, false);
  assert.equal(graph.edges.some((edge) => edge.isAllocated), false);
});
