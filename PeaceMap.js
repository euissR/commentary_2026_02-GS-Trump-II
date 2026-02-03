import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
import { CONFIG } from "./config.js";

export class PeaceMap {
  constructor(container) {
    this.isMobile = window.innerWidth <= 768;
    this.container = container;

    // Get container dimensions - matching DotMapPlot pattern
    const containerRect = container.getBoundingClientRect();
    this.width = Math.floor(containerRect.width);
    this.height = Math.min(this.width, window.innerHeight * 0.9);

    this.currentStep = 0;

    this.init();

    window.addEventListener("resize", () => {
      const containerRect = this.container.getBoundingClientRect();
      this.width = Math.floor(containerRect.width);
      this.height = Math.min(this.width, window.innerHeight * 0.9);
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
        d3.json(`${CONFIG.BASE_URL}/peace_sf.geojson`),
        d3.json(`${CONFIG.BASE_URL}/peace_countries.geojson`),
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
    this.projection = d3
      .geoOrthographic()
      .scale(this.isMobile ? this.width / 2.1 : this.width / 2.5)
      .center([0, 0])
      .rotate([-60, -29])
      .translate([this.width / 2, this.height / 2]);

    this.path = d3.geoPath().projection(this.projection);
  }

  setupColorScale() {
    this.colorScale = d3
      .scaleOrdinal()
      .domain(["Yes", "No"])
      .range(["#309ebe", "#df3144"]);
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
      .attr("opacity", 0.33)
      .attr("stroke", "#595959")
      .attr("stroke-width", 0.5);

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
      .attr("stroke-width", 1)
      .style("opacity", 0);

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

    this.setupLegend();
    this.setupTooltip();

    this.titleText = this.svg
      .append("text")
      .attr("class", "viz-title")
      .attr("x", this.width)
      .attr("y", this.isMobile ? 20 : 40)
      .text("The wars Trump claims to have solved");
  }

  setupLegend() {
    this.legend = this.svg.append("g").attr("class", "legend");

    if (this.isMobile) {
      this.legend.attr("transform", `translate(20, 20)`);
    } else {
      this.legend.attr(
        "transform",
        `translate(${this.width * 0.66}, ${this.height * 0.7})`,
      );
    }

    const legendItems = [
      {
        label: "Peace deal/ceasefire reached in 2025",
        color: "#309ebe",
        opacity: 1,
        type: "dot",
      },
      {
        label: "No peace deal/ceasefire reached in 2025",
        color: "#df3144",
        opacity: 1,
        type: "dot",
      },
      {
        label: "No open conflict in 2025",
        color: "#df3144",
        opacity: 0.5,
        type: "dot",
      },
      { label: "Minerals deal", color: "#000", opacity: 1, type: "circle" },
    ];

    legendItems.forEach((item, i) => {
      const group = this.legend
        .append("g")
        .attr("transform", `translate(0, ${i * 15})`);

      if (item.type === "dot") {
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
        group
          .append("circle")
          .attr("cx", 5)
          .attr("cy", 0)
          .attr("r", 10)
          .attr("fill", "none")
          .attr("stroke", item.color)
          .attr("stroke-width", 1);
      }

      group
        .append("text")
        .attr("x", 20)
        .attr("y", 0)
        .attr("dy", "0.35em")
        .style("font-size", "14px")
        .style("fill", "#595959")
        .text(item.label);

      if (i === legendItems.length - 1) {
        this.mineralsLegendItem = group;
        group.style("opacity", 0);
      }
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
    let html = `<strong>${props.name}</strong><br/>Resolution: ${props.res}<br/>`;
    if (this.currentStep < 7 && props.role) {
      html += `<br/><em>Trump's role:</em><br/>${props.role}`;
    } else if (props.min) {
      html += `<br/><em>Minerals component:</em><br/>${props.min}`;
    }
    if (props.war) html += `<em>${props.war}</em>`;

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

  highlightStep(step) {
    this.currentStep = step;
    const stepMapping = {
      1: ["Israel-Hamas"],
      2: ["DRC - Rwanda", "Armenia - Azerbaijan"],
      3: ["Cambodia-Thailand"],
      4: ["Israel-Iran (12 Day War)"],
      5: ["India-Pakistan"],
      6: ["Egypt-Ethiopia Renaissance Dam dispute", "Serbia-Kosovo"],
    };
    const highlightedNames = stepMapping[step] || [];

    this.dots
      .transition()
      .duration(500)
      .attr("r", (d) => (highlightedNames.includes(d.properties.name) ? 10 : 5))
      .style("opacity", (d) => {
        if (d.properties.war) return 0.5;
        return highlightedNames.includes(d.properties.name) ? 1 : 0.7;
      });

    this.outerCircles
      .transition()
      .duration(500)
      .attr("r", (d) =>
        highlightedNames.includes(d.properties.name) ? 20 : 10,
      )
      .attr("stroke-width", (d) =>
        highlightedNames.includes(d.properties.name) ? 2 : 1,
      )
      .style("opacity", step >= 7 ? 1 : 0);

    if (this.mineralsLegendItem) {
      this.mineralsLegendItem
        .transition()
        .duration(500)
        .style("opacity", step >= 7 ? 1 : 0);
    }
  }

  resize() {
    this.isMobile = window.innerWidth <= 768;
    this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);
    this.projection
      .scale(this.width / 2.5)
      .translate([this.width / 2, this.height / 2]);
    this.land.attr("d", this.path);
    this.peaceCountriesGroup.selectAll(".peace-country").attr("d", this.path);
    this.dots
      .attr("cx", (d) => this.projection(d.geometry.coordinates)[0])
      .attr("cy", (d) => this.projection(d.geometry.coordinates)[1]);
    this.outerCircles
      .attr("cx", (d) => this.projection(d.geometry.coordinates)[0])
      .attr("cy", (d) => this.projection(d.geometry.coordinates)[1]);
    if (this.isMobile) {
      const legendY = this.height * 0.75;
      this.legend.attr(
        "transform",
        `translate(${this.width / 2 - 100}, ${legendY})`,
      );
    } else {
      this.legend.attr(
        "transform",
        `translate(${this.width * 0.66}, ${this.height * 0.7})`,
      );
    }
    this.titleText.attr("x", this.width);
  }
}

export default PeaceMap;
