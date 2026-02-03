import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
import { CONFIG } from "./config.js";

export class ChoroplethMap {
  constructor(container) {
    this.container = container;

    // ⬇️ measure the sticky full-width container instead of the column
    const body = container.closest(".field--name-body");
    const rect = body.getBoundingClientRect();
    this.width = rect.width;
    this.height = Math.min(this.width * 0.8, window.innerHeight * 0.95);

    // Right column for title + legend
    this.legendWidth = 220;

    // Map height
    this.mapHeight = rect.width * 0.55;
    this.height = this.mapHeight;

    this.currentView = "categorical"; // Track current fill type

    this.init();

    window.addEventListener("resize", () => {
      const body = container.closest(".field--name-body");
      const rect = body.getBoundingClientRect();

      this.width = rect.width;
      this.height = Math.min(this.width * 0.8, window.innerHeight * 0.95);
      this.resize();
    });
  }

  async init() {
    await this.loadData();
    this.setupProjection();
    this.setupColorScales();
    this.createSVG();
    this.setupElements();
  }

  async loadData() {
    try {
      const [ieepaSf, worldData] = await Promise.all([
        d3.json(`${CONFIG.BASE_URL}/ieepa_sf.geojson`),
        d3.json("https://unpkg.com/world-atlas@2/land-110m.json"),
      ]);

      this.ieepaSf = ieepaSf;
      this.worldData = worldData;

      console.log("IEEPA data loaded:", {
        ieepaSfFeatures: ieepaSf.features.length,
      });
    } catch (error) {
      console.error("Error loading data:", error);
      throw error;
    }
  }

  setupProjection() {
    const mapAreaWidth = this.width - this.legendWidth;
    this.projection = d3
      .geoEqualEarth()
      .scale(mapAreaWidth / 6)
      .translate([mapAreaWidth / 2, this.mapHeight / 2]);

    this.path = d3.geoPath().projection(this.projection);
  }

  setupColorScales() {
    // Categorical color scale for "cat"
    this.categoricalScale = d3
      .scaleOrdinal()
      .domain([
        "Reciprocal",
        "Exempt",
        'Reciprocal and Limitations on "free speech"',
        "Fentanyl crisis",
      ])
      .range(["#309ebe", "#C6C6C6", "#1d3956", "#df3144"]);

    // Continuous color scale for "rate"
    const rateExtent = d3.extent(
      this.ieepaSf.features,
      (d) => d.properties.rate,
    );
    this.continuousScale = d3
      .scaleSequential()
      .domain(rateExtent)
      .interpolator(
        d3.interpolateRgbBasis([
          "#fff",
          "#FFDE75",
          "#64C2C7",
          "#376882",
          "#33163A",
        ]),
      );
  }

  createSVG() {
    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("width", this.width)
      .attr("height", this.height);
  }

  setupElements() {
    // Add background land (no fill, gray stroke)
    this.land = this.svg
      .append("path")
      .datum(topojson.feature(this.worldData, this.worldData.objects.land))
      .attr("class", "land")
      .attr("d", this.path)
      .attr("fill", "none")
      .attr("stroke", "#c6c6c6")
      .attr("stroke-width", 0.5);

    // Add IEEPA countries (choropleth)
    this.countries = this.svg
      .append("g")
      .attr("class", "ieepa-countries")
      .selectAll(".ieepa-country")
      .data(this.ieepaSf.features)
      .enter()
      .append("path")
      .attr("class", "ieepa-country")
      .attr("d", this.path)
      .attr("fill", (d) => this.categoricalScale(d.properties.cat))
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .on("mouseover", (event, d) => this.showTooltip(event, d))
      .on("mouseout", () => this.hideTooltip());

    // Setup legends
    this.setupLegends();

    // Setup tooltip
    this.setupTooltip();
  }

  setupLegends() {
    const legendX = this.width - this.legendWidth;

    // ── vertical rhythm ──────────────────────────
    const titleY = 24; // title baseline
    this.catLegendY = 56; // categorical group origin  (subtitle baseline)
    //   subtitle at +0, items at +22 … +102  →  bottom of last circle at +108
    this.contLegendY = this.catLegendY + 108 + 24; // 24 px gap before continuous

    // ── white background panel (behind everything in this column) ──
    this.legendBg = this.svg
      .append("rect")
      .attr("x", legendX)
      .attr("y", 0)
      .attr("width", this.legendWidth)
      .attr("height", this.height)
      .attr("fill", "rgba(255,255,255,0.92)");

    // ── title ─────────────────────────────────────
    this.titleText = this.svg
      .append("text")
      .attr("class", "viz-title")
      .attr("x", legendX + this.legendWidth - 12)
      .attr("y", titleY)
      .attr("text-anchor", "end")
      .style("font-size", "15px")
      .style("font-weight", "700")
      .style("fill", "#000")
      .style("paint-order", "stroke")
      .style("stroke", "#fff")
      .style("stroke-width", "4")
      .text("Countries targeted by Trump tariffs");

    // ── categorical legend ────────────────────────
    this.categoricalLegend = this.svg
      .append("g")
      .attr("class", "categorical-legend")
      .attr("transform", `translate(${legendX}, ${this.catLegendY})`)
      .style("opacity", 1);

    this.categoricalLegend
      .append("text")
      .attr("x", this.legendWidth - 12)
      .attr("y", 0)
      .attr("text-anchor", "end")
      .style("font-size", "12px")
      .style("font-weight", "700")
      .style("fill", "#333")
      .text("Tariff category");

    const catItems = [
      { label: "Reciprocal", color: "#309ebe" },
      { label: "Exempt", color: "#C6C6C6" },
      { label: "Fentanyl crisis", color: "#df3144" },
      { label: "Reciprocal + free speech", color: "#376882" },
      { label: "Reciprocal + Russian oil", color: "#1d3956" },
    ];

    catItems.forEach((item, i) => {
      const g = this.categoricalLegend
        .append("g")
        .attr("transform", `translate(0, ${22 + i * 20})`);

      // label – right-aligned, to the left of the dot
      g.append("text")
        .attr("x", this.legendWidth - 24)
        .attr("y", 9)
        .attr("text-anchor", "end")
        .style("font-size", "11px")
        .style("fill", "#333")
        .text(item.label);

      // dot
      g.append("circle")
        .attr("cx", this.legendWidth - 10)
        .attr("cy", 6)
        .attr("r", 6)
        .attr("fill", item.color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);
    });

    // ── continuous legend ─────────────────────────
    this.continuousLegend = this.svg
      .append("g")
      .attr("class", "continuous-legend")
      .attr("transform", `translate(${legendX}, ${this.contLegendY})`)
      .style("opacity", 0);

    this.continuousLegend
      .append("text")
      .attr("x", this.legendWidth - 12)
      .attr("y", 0)
      .attr("text-anchor", "end")
      .style("font-size", "12px")
      .style("font-weight", "700")
      .style("fill", "#333")
      .text("Tariff rate (%)");

    // gradient definition
    const defs = this.svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "rate-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");

    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#fff");
    gradient.append("stop").attr("offset", "25%").attr("stop-color", "#FFDE75");
    gradient.append("stop").attr("offset", "50%").attr("stop-color", "#64C2C7");
    gradient.append("stop").attr("offset", "75%").attr("stop-color", "#376882");
    gradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#33163A");

    // gradient bar – spans most of the column width
    const barX = 10;
    const barW = this.legendWidth - 22;
    this.continuousLegend
      .append("rect")
      .attr("class", "gradient-bar")
      .attr("x", barX)
      .attr("y", 18)
      .attr("width", barW)
      .attr("height", 10)
      .attr("rx", 5)
      .style("fill", "url(#rate-gradient)")
      .attr("stroke", "#999")
      .attr("stroke-width", 0.5);

    // min / mid / max labels below the bar
    const rateExtent = d3.extent(
      this.ieepaSf.features,
      (d) => d.properties.rate,
    );

    this.continuousLegend
      .append("text")
      .attr("x", barX)
      .attr("y", 42)
      .style("font-size", "10px")
      .style("fill", "#666")
      .text(`${Math.round(rateExtent[0])}%`);

    this.continuousLegend
      .append("text")
      .attr("x", barX + barW / 2)
      .attr("y", 42)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "#666")
      .text(`${Math.round((rateExtent[0] + rateExtent[1]) / 2)}%`);

    this.continuousLegend
      .append("text")
      .attr("x", barX + barW)
      .attr("y", 42)
      .attr("text-anchor", "end")
      .style("font-size", "10px")
      .style("fill", "#666")
      .text(`${Math.round(rateExtent[1])}%`);
  }

  setupTooltip() {
    this.tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("padding", "10px")
      .style("background", "#fff")
      .style("border", "1px solid #ccc")
      .style("border-radius", "4px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 1000);
  }

  showTooltip(event, d) {
    const props = d.properties;
    let html = `<strong>${props.country}</strong><br/>`;
    html += `Category: ${props.cat}<br/>`;
    html += `Rate: ${props.rate}%<br/>`;
    if (props.note) {
      html += `<br/><em>${props.note}</em>`;
    }

    this.tooltip
      .style("opacity", 1)
      .html(html)
      .style("left", event.pageX + 10 + "px")
      .style("top", event.pageY - 10 + "px");
  }

  hideTooltip() {
    this.tooltip.style("opacity", 0);
  }

  resize() {
    // Update SVG size
    this.svg.attr("width", this.width).attr("height", this.height);

    // Update projection – same math as setupProjection
    const mapAreaWidth = this.width - this.legendWidth;
    this.projection
      .scale(mapAreaWidth / 6)
      .translate([mapAreaWidth / 2, this.mapHeight / 2]);

    // Update all paths
    this.land.attr("d", this.path);
    this.countries.attr("d", this.path);

    // Reposition legend panel + groups
    const legendX = this.width - this.legendWidth;
    this.legendBg
      .attr("x", legendX)
      .attr("width", this.legendWidth)
      .attr("height", this.height);

    this.titleText.attr("x", legendX + this.legendWidth - 12);

    this.categoricalLegend.attr(
      "transform",
      `translate(${legendX}, ${this.catLegendY})`,
    );

    this.continuousLegend.attr(
      "transform",
      `translate(${legendX}, ${this.contLegendY})`,
    );
  }

  toggleView(isContinuous, step) {
    if (isContinuous) {
      // Switch to continuous (rate) view
      this.currentView = "continuous";

      this.countries
        .transition()
        .duration(1000)
        .attr("fill", (d) => this.continuousScale(d.properties.rate));

      // Switch legends
      this.categoricalLegend.transition().duration(500).style("opacity", 0);
      this.continuousLegend
        .transition()
        .duration(500)
        .delay(500)
        .style("opacity", 1);
    } else {
      // Switch to categorical (cat) view
      this.currentView = "categorical";

      this.countries
        .transition()
        .duration(1000)
        .attr("fill", (d) => this.categoricalScale(d.properties.cat));

      // Switch legends
      this.continuousLegend.transition().duration(500).style("opacity", 0);
      this.categoricalLegend
        .transition()
        .duration(500)
        .delay(500)
        .style("opacity", 1);
    }
  }
}

export default ChoroplethMap;
