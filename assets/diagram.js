async function renderDiagram(container, { nodes, edges }) {
  const { default: cytoscape } = await import("https://cdn.jsdelivr.net/npm/cytoscape@3.33.1/dist/cytoscape.esm.min.mjs");
  const graph = cytoscape({
    container,
    elements: [
      ...nodes.map(({ id, label, reference, url }) => ({
        data: { id: "node:" + id, label, reference, url }
      })),
      ...edges.map(({ from, to, label }) => ({
        data: { source: "node:" + from, target: "node:" + to, label: label || "" }
      }))
    ],
    layout: { name: "breadthfirst", directed: true, padding: 24 },
    style: [
      { selector: "node", style: {
        label: "data(label)", shape: "round-rectangle", width: 126, height: 50,
        "background-color": "#145578", color: "white", "font-size": 13,
        "border-width": 2, "border-color": "#7ec8e3",
        "text-valign": "center", "text-wrap": "wrap", "text-max-width": 116
      } },
      { selector: "edge", style: {
        label: "data(label)", "curve-style": "bezier", "target-arrow-shape": "triangle",
        width: 2, "font-size": 12, "text-background-color": "white", "text-background-opacity": 1
      } }
    ]
  });
  graph.on("tap", "node", (event) => {
    const url = event.target.data("url");
    if (typeof url === "string" && url.startsWith("https://")) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  });
  container.style.cursor = "pointer";
  graph.on("mouseover", "node", () => { container.style.cursor = "pointer"; });
  graph.on("mouseout", "node", () => { container.style.cursor = "default"; });
  return graph;
}

function diagramPngOptions() {
  return { full: true, scale: 2, bg: "#ffffff" };
}

document.addEventListener("alpine:init", () => {
  Alpine.data("diagram", () => {
    let graph;
    let disposed = false;
    return {
      ready: false,
      async init() {
        const container = this.$refs.view;
        try {
          await this.$nextTick();
          if (disposed) return;
          graph = await renderDiagram(container, JSON.parse(container.dataset.graph));
          if (disposed) graph.destroy();
          else this.ready = true;
        } catch {
          container.removeAttribute("role");
          container.textContent = "Impossible d’afficher ce diagramme.";
        }
      },
      async exportDiagram() {
        if (!this.ready) return;
        this.ready = false;
        try {
          const blob = await graph.png({ ...diagramPngOptions(), output: "blob-promise" });
          const name = this.$refs.view.getAttribute("aria-label");
          downloadBlob(blob, (name.replace(/[^\p{L}\p{N}._-]+/gu, "-") || "diagramme") + ".png");
        } catch {
          this.setStatus("Impossible de créer le PNG du diagramme.", true);
        } finally {
          this.ready = true;
        }
      },
      destroy() {
        disposed = true;
        graph?.destroy();
      }
    };
  });
});

