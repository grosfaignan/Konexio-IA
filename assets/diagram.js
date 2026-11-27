document.addEventListener("alpine:init", () => {
  Alpine.data("diagram", () => {
    let graph;
    let disposed = false;
    return {
      async init() {
        const container = this.$el;
        try {
          const { nodes, edges } = JSON.parse(container.dataset.graph);
          const { default: cytoscape } = await import("https://cdn.jsdelivr.net/npm/cytoscape@3.33.1/dist/cytoscape.esm.min.mjs");
          await this.$nextTick();
          if (disposed || !container.isConnected) return;
          graph = cytoscape({
            container,
            elements: [
              ...nodes.map(({ id, label }) => ({ data: { id: "node:" + id, label } })),
              ...edges.map(({ from, to, label }) => ({
                data: { source: "node:" + from, target: "node:" + to, label: label || "" }
              }))
            ],
            layout: { name: "breadthfirst", directed: true, padding: 24 },
            style: [
              { selector: "node", style: {
                label: "data(label)", shape: "round-rectangle", width: 126, height: 50,
                "background-color": "#145578", color: "white", "font-size": 13,
                "text-valign": "center", "text-wrap": "wrap", "text-max-width": 116
              } },
              { selector: "edge", style: {
                label: "data(label)", "curve-style": "bezier", "target-arrow-shape": "triangle",
                width: 2, "font-size": 12, "text-background-color": "white", "text-background-opacity": 1
              } }
            ]
          });
        } catch {
          container.removeAttribute("role");
          container.textContent = "Impossible d’afficher ce diagramme.";
        }
      },
      destroy() {
        disposed = true;
        graph?.destroy();
      }
    };
  });
});
