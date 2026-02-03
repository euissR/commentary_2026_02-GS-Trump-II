import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
import { CONFIG } from "./config.js";

export class MapDotPlot {
  constructor(container) {
    this.container = container;

    // Get container dimensions - matching DotMapPlot pattern
    const containerRect = container.getBoundingClientRect();
    this.width = Math.floor(containerRect.width);
    this.height = Math.min(this.width, window.innerHeight * 0.9);

    this.margin = { top: 200, right: 300, bottom: 0, left: 0 };

    this.scatterWidth = this.width * 0.9;
    this.scatterHeight = this.height * 0.75;
    this.scatterOffsetX = (this.width - this.scatterWidth) / 2;
    this.scatterOffsetY = (this.height - this.scatterHeight) / 2;

    this.isScatterView = false;
    this.scrollAnimationActive = false;
    this.currentTransitionCard = null;
    this.transitionDirection = null;
    this.rafId = null;

    this.init();

    window.addEventListener("resize", () => {
      const containerRect = this.container.getBoundingClientRect();
      this.width = Math.floor(containerRect.width);
      this.height = Math.min(this.width, window.innerHeight * 0.9);
      this.scatterWidth = this.width * 0.9;
      this.scatterHeight = this.height * 0.8;
      this.scatterOffsetX = (this.width - this.scatterWidth) / 2;
      this.scatterOffsetY = (this.height - this.scatterHeight) / 2;
      this.resize();
    });

    this.stepTypeMap = {
      3: "Tariff and market access",
      4: "Economic security",
      5: "Buy/invest American",
    };
  }

  async init() {
    await this.loadData();
    this.setupProjection();
    this.setupScales();
    this.createSVG();
    this.setupElements();
  }

  async loadData() {
    try {
      const [geoData, worldData] = await Promise.all([
        d3.json(`${CONFIG.BASE_URL}/trade_sf.geojson`),
        d3.json("https://unpkg.com/world-atlas@2/land-110m.json"),
      ]);

      this.geoData = geoData;
      this.worldData = worldData;

      this.countries = [
        ...new Set(geoData.features.map((d) => d.properties.country)),
      ].sort();
      this.types = [...new Set(geoData.features.map((d) => d.properties.type))];

      const namesByType = {};
      this.types.forEach((type) => {
        namesByType[type] = [
          ...new Set(
            geoData.features
              .filter((d) => d.properties.type === type)
              .map((d) => d.properties.name),
          ),
        ].sort();
      });

      this.names = [];
      this.types.forEach((type) => {
        this.names = this.names.concat(namesByType[type]);
      });

      console.log("Data loaded:", {
        features: geoData.features.length,
        countries: this.countries.length,
        types: this.types.length,
        names: this.names.length,
      });
    } catch (error) {
      console.error("Error loading data:", error);
      throw error;
    }
  }

  setupProjection() {
    this.projection = d3
      .geoEqualEarth()
      .scale(this.width / 6)
      .translate([this.width / 2, this.height / 2]);

    this.path = d3.geoPath().projection(this.projection);
  }

  setupScales() {
    this.xScale = d3
      .scalePoint()
      .domain(this.countries)
      .range([this.margin.left, this.width - this.margin.right])
      .padding(0.5);

    this.yScale = d3
      .scalePoint()
      .domain(this.names)
      .range([this.margin.top, this.scatterOffsetY + this.scatterHeight])
      .padding(0.5);

    this.colorScale = d3
      .scaleOrdinal()
      .domain(this.types)
      .range(["#1d3956", "#df3144", "#309ebe", "#a41e26", "#33163a"]);
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
    this.setupMap();
    this.setupAxes();
    this.setupDataPoints();
    this.setupTooltip();

    this.titleText = this.svg
      .append("text")
      .attr("class", "viz-title")
      .attr("x", this.width)
      .attr("y", 20)
      .text("US trade deals under Trump 2.0");
  }

  setupMap() {
    this.mapGroup = this.svg.append("g").style("opacity", 1);

    this.land = this.mapGroup
      .append("path")
      .datum(topojson.feature(this.worldData, this.worldData.objects.land))
      .attr("class", "land")
      .attr("d", this.path)
      .attr("fill", "#fff")
      .attr("stroke", "#c6c6c6")
      .attr("stroke-width", 0.5);

    this.countriesGroup = this.mapGroup
      .append("g")
      .attr("class", "trade-countries");

    const countryFeatures = d3.group(
      this.geoData.features,
      (d) => d.properties.country,
    );

    countryFeatures.forEach((features, country) => {
      this.countriesGroup
        .append("path")
        .datum(features[0])
        .attr("class", "trade-country")
        .attr("d", this.path)
        .attr("fill", "#c6c6c6")
        .attr("opacity", 0.33)
        .attr("stroke", "#999")
        .attr("stroke-width", 0.5)
        .style("pointer-events", "auto")
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => this.showTooltip(event, d))
        .on("mouseout", () => this.hideTooltip());
    });
  }

  setupAxes() {
    this.axesGroup = this.svg.append("g").style("opacity", 0);

    this.xAxisGroup = this.axesGroup
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${this.margin.top})`)
      .call(d3.axisTop(this.xScale));

    this.xAxisGroup
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "start")
      .attr("dy", "1em")
      .style("font-size", "11px")
      .style("fill", "#666");

    this.yAxisGroup = this.axesGroup
      .append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(this.yScale));

    this.axesGroup.selectAll(".domain").remove();
    this.axesGroup.selectAll(".tick line").remove();

    this.yAxisGroup
      .selectAll(".tick text")
      .attr("x", this.width - this.margin.right)
      .style("text-anchor", "start")
      .style("font-size", "11px")
      .style("fill", "#666");

    this.gridlinesGroup = this.axesGroup.append("g").attr("class", "gridlines");

    this.gridlinesGroup
      .selectAll(".grid-vertical")
      .data(this.countries)
      .enter()
      .append("line")
      .attr("class", "grid-vertical")
      .attr("x1", (d) => this.xScale(d))
      .attr("x2", (d) => this.xScale(d))
      .attr("y1", this.margin.top)
      .attr("y2", this.scatterOffsetY + this.scatterHeight)
      .attr("stroke", "#c6c6c6")
      .attr("stroke-width", 0.5);

    this.gridlinesGroup
      .selectAll(".grid-horizontal")
      .data(this.names)
      .enter()
      .append("line")
      .attr("class", "grid-horizontal")
      .attr("x1", this.margin.left)
      .attr("x2", this.width - this.margin.right)
      .attr("y1", (d) => this.yScale(d))
      .attr("y2", (d) => this.yScale(d))
      .attr("stroke", "#c6c6c6")
      .attr("stroke-width", 0.5);
  }

  setupDataPoints() {
    this.dots = this.svg
      .selectAll(".trade-dot")
      .data(this.geoData.features)
      .enter()
      .append("circle")
      .attr("class", "trade-dot")
      .attr("r", 6)
      .attr(
        "cx",
        (d) => this.projection([d.properties.lon, d.properties.lat])[0],
      )
      .attr(
        "cy",
        (d) => this.projection([d.properties.lon, d.properties.lat])[1],
      )
      .attr("fill", "#595959")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .style("opacity", 1)
      .style("pointer-events", "none")
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => this.showTooltip(event, d))
      .on("mouseout", () => this.hideTooltip());
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
    if (this.isScatterView) {
      this.tooltip
        .style("opacity", 1)
        .html(`<strong>${props.country}</strong><br/>${props.name}`)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 10 + "px");
    } else {
      this.tooltip
        .style("opacity", 1)
        .html(`<strong>${props.country}</strong>`)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 10 + "px");
    }
  }

  hideTooltip() {
    this.tooltip.style("opacity", 0);
  }

  resize() {
    this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);

    this.projection
      .scale(this.width / 6)
      .translate([this.width / 2, this.height / 2]);

    this.xScale.range([this.margin.left, this.width - this.margin.right]);
    this.yScale.range([
      this.margin.top,
      this.scatterOffsetY + this.scatterHeight,
    ]);

    this.land.attr("d", this.path);
    this.countriesGroup.selectAll(".trade-country").attr("d", this.path);

    this.xAxisGroup
      .attr("transform", `translate(0, ${this.margin.top})`)
      .call(d3.axisTop(this.xScale));
    this.xAxisGroup
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .attr("dx", "-0.5em")
      .attr("dy", "-0.5em")
      .style("font-size", "11px")
      .style("fill", "#666");

    this.yAxisGroup.call(d3.axisLeft(this.yScale));
    this.axesGroup.selectAll(".domain").remove();
    this.axesGroup.selectAll(".tick line").remove();
    this.yAxisGroup
      .selectAll(".tick text")
      .attr("x", this.width - this.margin.right)
      .style("text-anchor", "start")
      .style("font-size", "11px")
      .style("fill", "#666");

    this.gridlinesGroup
      .selectAll(".grid-vertical")
      .attr("x1", (d) => this.xScale(d))
      .attr("x2", (d) => this.xScale(d))
      .attr("y1", this.margin.top)
      .attr("y2", this.scatterOffsetY + this.scatterHeight);

    this.gridlinesGroup
      .selectAll(".grid-horizontal")
      .attr("x1", this.margin.left)
      .attr("x2", this.width - this.margin.right)
      .attr("y1", (d) => this.yScale(d))
      .attr("y2", (d) => this.yScale(d));

    if (this.isScatterView) {
      this.dots
        .attr("cx", (d) => this.xScale(d.properties.country))
        .attr("cy", (d) => this.yScale(d.properties.name));
    } else {
      this.dots
        .attr(
          "cx",
          (d) => this.projection([d.properties.lon, d.properties.lat])[0],
        )
        .attr(
          "cy",
          (d) => this.projection([d.properties.lon, d.properties.lat])[1],
        );
    }

    this.titleText.attr("x", this.width);
  }

  toggleView(isScatter, step) {
    this.isScatterView = isScatter;

    if (isScatter) {
      this.dots
        .transition()
        .duration(1000)
        .attr("cx", (d) => this.xScale(d.properties.country))
        .attr("cy", (d) => this.yScale(d.properties.name))
        .attr("r", 6)
        .attr("fill", (d) => this.colorScale(d.properties.type))
        .style("opacity", 1);

      this.mapGroup.transition().duration(1000).style("opacity", 0);
      this.axesGroup.transition().duration(1000).style("opacity", 1);
    } else {
      this.dots
        .transition()
        .duration(1000)
        .attr(
          "cx",
          (d) => this.projection([d.properties.lon, d.properties.lat])[0],
        )
        .attr(
          "cy",
          (d) => this.projection([d.properties.lon, d.properties.lat])[1],
        )
        .attr("r", 6)
        .attr("fill", "#595959")
        .style("opacity", 1);

      this.mapGroup.transition().duration(1000).style("opacity", 1);
      this.axesGroup.transition().duration(1000).style("opacity", 0);
    }
  }

  highlightTypeByStep(step) {
    const activeType = this.stepTypeMap[step];

    if (!activeType) {
      this.dots.transition().duration(400).style("opacity", 1).attr("r", 6);
      return;
    }

    this.dots
      .transition()
      .duration(400)
      .style("opacity", (d) => (d.properties.type === activeType ? 1 : 0.15))
      .attr("r", (d) => (d.properties.type === activeType ? 10 : 6));
  }

  setTransitionProgress(isScatter, progress) {
    progress = Math.max(0, Math.min(1, progress));
    this.isScatterView = isScatter;

    if (isScatter) {
      this.dots
        .attr("cx", (d) => {
          const startX = this.projection([
            d.properties.lon,
            d.properties.lat,
          ])[0];
          const endX = this.xScale(d.properties.country);
          return d3.interpolate(startX, endX)(progress);
        })
        .attr("cy", (d) => {
          const startY = this.projection([
            d.properties.lon,
            d.properties.lat,
          ])[1];
          const endY = this.yScale(d.properties.name);
          return d3.interpolate(startY, endY)(progress);
        })
        .attr("fill", (d) => {
          const startColor = "#595959";
          const endColor = this.colorScale(d.properties.type);
          return d3.interpolateRgb(startColor, endColor)(progress);
        });

      this.mapGroup.style("opacity", 1 - progress);
      this.axesGroup.style("opacity", progress);
    } else {
      this.dots
        .attr("cx", (d) => {
          const startX = this.xScale(d.properties.country);
          const endX = this.projection([d.properties.lon, d.properties.lat])[0];
          return d3.interpolate(startX, endX)(progress);
        })
        .attr("cy", (d) => {
          const startY = this.yScale(d.properties.name);
          const endY = this.projection([d.properties.lon, d.properties.lat])[1];
          return d3.interpolate(startY, endY)(progress);
        })
        .attr("fill", (d) => {
          const startColor = this.colorScale(d.properties.type);
          const endColor = "#595959";
          return d3.interpolateRgb(startColor, endColor)(progress);
        });

      this.mapGroup.style("opacity", progress);
      this.axesGroup.style("opacity", 1 - progress);
    }
  }

  calculateScrollProgress(card) {
    const rect = card.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const cardTop = rect.top;
    const startY = viewportHeight * 0.8;
    const endY = viewportHeight * 0.2;
    let progress = (startY - cardTop) / (startY - endY);
    return Math.max(0, Math.min(1, progress));
  }

  updateScrollAnimation() {
    if (!this.scrollAnimationActive || !this.currentTransitionCard) return;
    const progress = this.calculateScrollProgress(this.currentTransitionCard);
    if (this.transitionDirection === "toScatter") {
      this.setTransitionProgress(true, progress);
    } else if (this.transitionDirection === "toMap") {
      this.setTransitionProgress(false, progress);
    }
    this.rafId = requestAnimationFrame(() => this.updateScrollAnimation());
  }

  startScrollAnimation(card, direction) {
    this.stopScrollAnimation();
    this.scrollAnimationActive = true;
    this.currentTransitionCard = card;
    this.transitionDirection = direction;
    this.updateScrollAnimation();
  }

  stopScrollAnimation() {
    this.scrollAnimationActive = false;
    this.currentTransitionCard = null;
    this.transitionDirection = null;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

export default MapDotPlot;
