import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
import { CONFIG } from "./config.js";

export class ChoroplethMap {
  constructor(container) {
    this.isMobile = window.innerWidth <= 768;
    this.container = container;

    // Get container dimensions - matching DotMapPlot pattern
    const containerRect = container.getBoundingClientRect();
    this.width = Math.floor(containerRect.width);
    this.height = Math.min(this.width, window.innerHeight * 0.9);

    this.currentView = "categorical";

    this.init();

    window.addEventListener("resize", () => {
      const containerRect = this.container.getBoundingClientRect();
      this.width = Math.floor(containerRect.width);
      this.height = Math.min(this.width, window.innerHeight * 0.9);
      this.resize();
    });

    // check for mobile
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
    // Full width map, offset down to make room for legend at top
    this.projection = d3
      .geoEqualEarth()
      .scale(this.isMobile ? this.width / 4.9 : this.width / 5.5)
      .translate([this.width / 2, this.height / 2 + 40]);

    this.path = d3.geoPath().projection(this.projection);
  }

  setupColorScales() {
    this.categoricalScale = d3
      .scaleOrdinal()
      .domain([
        "Reciprocal",
        "Exempt",
        'Reciprocal and limitations on "free speech"',
        "Fentanyl crisis",
      ])
      .range(["#309ebe", "#C6C6C6", "#1d3956", "#df3144"]);

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
    // Use viewBox for proper scaling (like DotMapPlot)
    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("viewBox", `0 0 ${this.width} ${this.height}`)
      .style("width", "100%")
      .style("height", "100%");
  }

  setupElements() {
    this.land = this.svg
      .append("path")
      .datum(topojson.feature(this.worldData, this.worldData.objects.land))
      .attr("class", "land")
      .attr("d", this.path)
      .attr("fill", "none")
      .attr("stroke", "#c6c6c6")
      .attr("stroke-width", 0.5);

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

    this.setupLegends();
    this.setupTooltip();
  }

  setupLegends() {
    const legendY = this.height - this.height * 0.75;

    // Title at top right
    this.titleText = this.svg
      .append("text")
      .attr("class", "viz-title")
      .attr("x", this.width)
      .attr("y", this.isMobile ? legendY - 60 : legendY - 50)
      .attr("text-anchor", "end")
      .text("Countries targeted by Trump tariffs");

    // Categorical legend - horizontal, below title
    this.categoricalLegend = this.svg
      .append("g")
      .attr("class", "categorical-legend")
      .attr(
        "transform",
        `translate(${this.isMobile ? this.width : this.width - 20}, ${this.isMobile ? legendY - 40 : legendY - 30})`,
      )
      .style("opacity", 1);

    const catItems = [
      { label: "Reciprocal", color: "#309ebe" },
      { label: "Exempt", color: "#C6C6C6" },
      { label: "Fentanyl crisis", color: "#df3144" },
      {
        label: "Reciprocal and limitations on 'free speech'",
        color: "#1d3956",
      },
    ];

    let xOffset = 0;
    const itemSpacing = 15;

    catItems
      .slice()
      .reverse()
      .forEach((item) => {
        const g = this.categoricalLegend
          .append("g")
          .attr("class", "cat-legend-item");
        const textWidth = item.label.length * 6;
        xOffset -= textWidth + 20 + itemSpacing;
        g.attr("transform", `translate(${xOffset}, 0)`);
        g.append("circle")
          .attr("cx", 0)
          .attr("cy", 4)
          .attr("r", 5)
          .attr("fill", item.color)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1);
        g.append("text")
          .attr("x", 10)
          .attr("y", 8)
          .attr("text-anchor", "start")
          .style("font-size", "14px")
          .style("fill", "#333")
          .text(item.label);
      });

    // Continuous legend (hidden initially)
    this.continuousLegend = this.svg
      .append("g")
      .attr("class", "continuous-legend")
      .attr(
        "transform",
        `translate(${this.width - 250}, ${this.isMobile ? legendY - 50 : legendY - 30})`,
      )
      .style("opacity", 0);

    this.continuousLegend
      .append("text")
      .attr("x", 0)
      .attr("y", 0)
      .attr("text-anchor", "start")
      .style("font-size", "14px")
      .style("font-weight", "700")
      .style("fill", "#333")
      .text("Tariff rate (%)");

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

    const barW = 200;
    this.continuousLegend
      .append("rect")
      .attr("class", "gradient-bar")
      .attr("x", 0)
      .attr("y", 15)
      .attr("width", barW)
      .attr("height", 10)
      .attr("rx", 5)
      .style("fill", "url(#rate-gradient)")
      .attr("stroke", "#999")
      .attr("stroke-width", 0.5);

    const rateExtent = d3.extent(
      this.ieepaSf.features,
      (d) => d.properties.rate,
    );
    this.continuousLegend
      .append("text")
      .attr("x", 0)
      .attr("y", 38)
      .style("font-size", "12px")
      .style("fill", "#666")
      .text(`${Math.round(rateExtent[0])}%`);
    this.continuousLegend
      .append("text")
      .attr("x", barW / 2)
      .attr("y", 38)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#666")
      .text(`${Math.round((rateExtent[0] + rateExtent[1]) / 2)}%`);
    this.continuousLegend
      .append("text")
      .attr("x", barW)
      .attr("y", 38)
      .attr("text-anchor", "end")
      .style("font-size", "12px")
      .style("fill", "#666")
      .text(`${Math.round(rateExtent[1])}%`);

    // Stack categorical legend vertically above map on mobile
    if (this.isMobile) {
      this.categoricalLegend.attr("transform", `translate(10, 50)`);

      this.categoricalLegend
        .selectAll(".cat-legend-item")
        .attr("transform", (_, i) => `translate(0, ${i * 18})`);
    }
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
    let html = `<strong>${props.country}</strong><br/>Category: ${props.cat}<br/>Rate: ${props.rate}%<br/>`;
    if (props.note) html += `<br/><em>${props.note}</em>`;
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
    this.isMobile = window.innerWidth <= 768;
    this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);
    this.projection
      .scale(this.width / 5)
      .translate([this.width / 2, this.height / 2 + 40]);
    this.land.attr("d", this.path);
    this.countries.attr("d", this.path);
    this.titleText.attr("x", this.width);
    if (this.isMobile) {
      this.categoricalLegend.attr(
        "transform",
        `translate(10, 30)`, // left-aligned, 20px higher
      );
    } else {
      this.categoricalLegend.attr(
        "transform",
        `translate(${this.width - 20}, 50)`,
      );
    }
    this.continuousLegend.attr(
      "transform",
      `translate(${this.width - 250}, 50)`,
    );
  }

  toggleView(isContinuous, step) {
    if (isContinuous) {
      this.currentView = "continuous";
      this.countries
        .transition()
        .duration(1000)
        .attr("fill", (d) => this.continuousScale(d.properties.rate));
      this.categoricalLegend.transition().duration(500).style("opacity", 0);
      this.continuousLegend
        .transition()
        .duration(500)
        .delay(500)
        .style("opacity", 1);
    } else {
      this.currentView = "categorical";
      this.countries
        .transition()
        .duration(1000)
        .attr("fill", (d) => this.categoricalScale(d.properties.cat));
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
