import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";

export class PeaceMap {
  constructor(container) {
    this.container = container;

    // Get container dimensions
    const containerRect = container.getBoundingClientRect();
    this.width = containerRect.width;
    this.height = containerRect.width;

    this.init();

    window.addEventListener("resize", () => {
      const containerRect = container.getBoundingClientRect();
      this.width = containerRect.width;
      this.height = containerRect.width;
      this.resize();
    });
  }

  async init() {
    await this.loadData();
    this.setupProjection();
    this.setupColorScale();
    this.createSVG();
    this.setupElements();
  }

  async loadData() {
    try {
      const [peaceSf, peaceCountries, worldData] = await Promise.all([
        d3.json("./peace_sf.geojson"),
        d3.json("./peace_countries.geojson"),
        d3.json("https://unpkg.com/world-atlas@2/land-110m.json"),
      ]);

      this.peaceSf = peaceSf;
      this.peaceCountries = peaceCountries;
      this.worldData = worldData;

      console.log("Peace data loaded:", {
        peaceSfFeatures: peaceSf.features.length,
        peaceCountries: peaceCountries.features.length,
      });
    } catch (error) {
      console.error("Error loading data:", error);
      throw error;
    }
  }

  setupProjection() {
    // Rotated 50 degrees further east than the strikes map
    // Original strikes map was [-90, -30], so this is [-40, -30]
    this.projection = d3
      .geoOrthographic()
      .scale(this.width / 2.5)
      .center([0, 0])
      .rotate([-60, -30])
      .translate([this.width / 2, this.height / 2]);

    this.path = d3.geoPath().projection(this.projection);
  }

  setupColorScale() {
    // Color scale for "res" property
    this.colorScale = d3
      .scaleOrdinal()
      .domain(["Yes", "No"])
      .range(["#309ebe", "#df3144"]); // Blue for Yes, Red for No
  }

  createSVG() {
    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("width", this.width)
      .attr("height", this.height);
  }

  setupElements() {
    // Add sphere (ocean)
    // this.sphere = this.svg
    //   .append("path")
    //   .datum({ type: "Sphere" })
    //   .attr("class", "sphere")
    //   .attr("d", this.path)
    //   .attr("fill", "#e0f2ff")
    //   .attr("stroke", "#999")
    //   .attr("stroke-width", 1);

    // Add land
    this.land = this.svg
      .append("path")
      .datum(topojson.feature(this.worldData, this.worldData.objects.land))
      .attr("class", "land")
      .attr("d", this.path)
      .attr("fill", "none")
      .attr("stroke", "#c6c6c6")
      .attr("stroke-width", 0.5);

    // Add peace countries (special highlight)
    this.peaceCountriesGroup = this.svg
      .append("g")
      .attr("class", "peace-countries");

    this.peaceCountriesGroup
      .selectAll(".peace-country")
      .data(this.peaceCountries.features)
      .enter()
      .append("path")
      .attr("class", "peace-country")
      .attr("d", this.path)
      .attr("fill", "#c6c6c6")
      .attr("stroke", "none");

    // Add outer circles for dots with "min" property (radius 10, no fill, black outline)
    this.outerCircles = this.svg
      .selectAll(".peace-outer-circle")
      .data(this.peaceSf.features.filter((d) => d.properties.min))
      .enter()
      .append("circle")
      .attr("class", "peace-outer-circle")
      .attr("cx", (d) => this.projection(d.geometry.coordinates)[0])
      .attr("cy", (d) => this.projection(d.geometry.coordinates)[1])
      .attr("r", 10)
      .attr("fill", "none")
      .attr("stroke", "#000")
      .attr("stroke-width", 1);

    // Add main dots (radius 5, filled by res)
    this.dots = this.svg
      .selectAll(".peace-dot")
      .data(this.peaceSf.features)
      .enter()
      .append("circle")
      .attr("class", "peace-dot")
      .attr("cx", (d) => this.projection(d.geometry.coordinates)[0])
      .attr("cy", (d) => this.projection(d.geometry.coordinates)[1])
      .attr("r", 5)
      .attr("fill", (d) => this.colorScale(d.properties.res))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .style("opacity", (d) => (d.properties.war ? 0.5 : 1))
      .on("mouseover", (event, d) => this.showTooltip(event, d))
      .on("mouseout", () => this.hideTooltip());

    // Setup legend
    this.setupLegend();

    // Setup tooltip
    this.setupTooltip();
  }

  setupLegend() {
    const legendX = this.width / 24;
    const legendY = this.height / 24;
    const itemSpacing = this.width / 4;

    this.legend = this.svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${legendX}, ${legendY})`);

    // Legend background
    // this.legend
    //   .append("rect")
    //   .attr("x", -10)
    //   .attr("y", -10)
    //   .attr("width", 180)
    //   .attr("height", itemSpacing * 4 + 20)
    //   .attr("fill", "white")
    //   .attr("stroke", "#ccc")
    //   .attr("rx", 4);

    const legendItems = [
      { label: "Peace deal", color: "#309ebe", opacity: 1, type: "dot" },
      { label: "No peace deal", color: "#df3144", opacity: 1, type: "dot" },
      { label: "No war in 2025", color: "#df3144", opacity: 0.5, type: "dot" },
      { label: "Minerals deal", color: "#000", opacity: 1, type: "circle" },
    ];

    legendItems.forEach((item, i) => {
      const group = this.legend
        .append("g")
        .attr("transform", `translate(${i * itemSpacing}, 0)`);

      if (item.type === "dot") {
        // Regular dot
        group
          .append("circle")
          .attr("cx", 5)
          .attr("cy", 0)
          .attr("r", 5)
          .attr("fill", item.color)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1)
          .style("opacity", item.opacity);
      } else if (item.type === "circle") {
        // Outer circle (minerals)
        group
          .append("circle")
          .attr("cx", 5)
          .attr("cy", 0)
          .attr("r", 10)
          .attr("fill", "none")
          .attr("stroke", item.color)
          .attr("stroke-width", 1);
      }

      // Label text
      group
        .append("text")
        .attr("x", 20)
        .attr("y", 0)
        .attr("dy", "0.35em")
        .style("font-size", "12px")
        .style("fill", "#333")
        .text(item.label);
    });
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
    let html = `<strong>${props.name}</strong><br/>`;
    html += `Resolution: ${props.res}<br/>`;
    if (props.min) {
      html += `<br/><em>Minerals component:</em><br/>${props.min}`;
    }
    if (props.war) {
      html += `<em>${props.war}</em>`;
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

  getUniqueNames() {
    return [...new Set(this.peaceSf.features.map((d) => d.properties.name))];
  }

  // for step highlights
  highlightStep(step) {
    // Get list of unique names
    const names = this.getUniqueNames();
    const highlightedName = names[step];

    // Update all dots
    this.dots
      .transition()
      .duration(500)
      .attr("r", (d) => (d.properties.name === highlightedName ? 10 : 5))
      .style("opacity", (d) => {
        if (d.properties.war) return 0.5;
        return d.properties.name === highlightedName ? 1 : 0.7;
      });

    // Update outer circles
    this.outerCircles
      .transition()
      .duration(500)
      .attr("r", (d) => (d.properties.name === highlightedName ? 20 : 10))
      .attr("stroke-width", (d) =>
        d.properties.name === highlightedName ? 2 : 1,
      );
  }

  resize() {
    // Update SVG size
    this.svg.attr("width", this.width).attr("height", this.height);

    // Update projection
    this.projection
      .scale(this.width / 2.5)
      .translate([this.width / 2, this.height / 2]);

    // Update all paths and circles
    // this.sphere.attr("d", this.path);
    this.land.attr("d", this.path);
    this.peaceCountriesGroup.selectAll(".peace-country").attr("d", this.path);

    this.dots
      .attr("cx", (d) => this.projection(d.geometry.coordinates)[0])
      .attr("cy", (d) => this.projection(d.geometry.coordinates)[1]);

    this.outerCircles
      .attr("cx", (d) => this.projection(d.geometry.coordinates)[0])
      .attr("cy", (d) => this.projection(d.geometry.coordinates)[1]);

    // Update legend position
    const legendX = this.width - 200;
    const legendY = this.height - 150;
    this.legend.attr("transform", `translate(${legendX}, ${legendY})`);
  }
}

export default PeaceMap;
