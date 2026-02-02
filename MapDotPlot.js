import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
import { CONFIG } from "./config.js";

export class MapDotPlot {
  constructor(container) {
    this.container = container;

    // Get container dimensions, constrained to viewport
    const containerRect = container.getBoundingClientRect();
    this.width = Math.min(containerRect.width, window.innerWidth * 0.95);
    this.height = Math.min(this.width, window.innerHeight * 0.95);

    this.margin = { top: 200, right: 300, bottom: 0, left: 0 };

    // Scatter plot dimensions
    this.scatterWidth = this.width * 0.9;
    this.scatterHeight = this.height * 0.75;
    this.scatterOffsetX = (this.width - this.scatterWidth) / 2;
    this.scatterOffsetY = (this.height - this.scatterHeight) / 2;

    this.isScatterView = false;

    // Scroll-bound animation state
    this.scrollAnimationActive = false;
    this.currentTransitionCard = null;
    this.transitionDirection = null; // 'toScatter' or 'toMap'
    this.rafId = null;

    this.init();

    window.addEventListener("resize", () => {
      const containerRect = container.getBoundingClientRect();
      this.width = Math.min(containerRect.width, window.innerWidth * 0.95);
      this.height = Math.min(this.width, window.innerHeight * 0.95);
      this.scatterWidth = this.width * 0.9;
      this.scatterHeight = this.height * 0.8;
      this.scatterOffsetX = (this.width - this.scatterWidth) / 2;
      this.scatterOffsetY = (this.height - this.scatterHeight) / 2;
      this.resize();
    });

    // Define a step → type mapping
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

      // Extract unique values for scales
      this.countries = [
        ...new Set(geoData.features.map((d) => d.properties.country)),
      ].sort();
      this.types = [...new Set(geoData.features.map((d) => d.properties.type))];

      // Create a sorted list of names by type
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

      // Flatten to create ordered list
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
    // Scatter plot scales
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

    // Color scale by type
    this.colorScale = d3
      .scaleOrdinal()
      .domain(this.types)
      .range(["#1d3956", "#df3144", "#309ebe", "#a41e26", "#33163a"]);
  }

  createSVG() {
    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("width", this.width)
      .attr("height", this.height);
  }

  setupElements() {
    // Setup world map (initially visible)
    this.setupMap();

    // Setup axes (initially hidden)
    this.setupAxes();

    // Setup legend
    this.setupLegend();

    // Setup data points
    this.setupDataPoints();

    // Setup tooltip
    this.setupTooltip();

    // Add title
    this.titleText = this.svg
      .append("text")
      .attr("class", "viz-title")
      .attr("x", this.width)
      .attr("y", 20) // Distance from top of SVG
      .text("US trade deals under Trump 2.0");
  }

  setupMap() {
    this.mapGroup = this.svg.append("g").style("opacity", 1);

    // Add land
    this.land = this.mapGroup
      .append("path")
      .datum(topojson.feature(this.worldData, this.worldData.objects.land))
      .attr("class", "land")
      .attr("d", this.path)
      .attr("fill", "#fff")
      .attr("stroke", "#c6c6c6")
      .attr("stroke-width", 0.5);

    // Add country outlines from geojson
    this.countriesGroup = this.mapGroup
      .append("g")
      .attr("class", "trade-countries");

    // Group features by country to avoid duplicates
    const countryFeatures = d3.group(
      this.geoData.features,
      (d) => d.properties.country,
    );

    // Draw one path per country
    countryFeatures.forEach((features, country) => {
      this.countriesGroup
        .append("path")
        .datum(features[0]) // Use first feature for the country
        .attr("class", "trade-country")
        .attr("d", this.path)
        .attr("fill", "#c6c6c6")
        .attr("opacity", 0.33)
        .attr("stroke", "#999")
        .attr("stroke-width", 0.5)
        .style("pointer-events", "auto") // Enabled in map view
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => this.showTooltip(event, d))
        .on("mouseout", () => this.hideTooltip());
    });
  }

  setupAxes() {
    this.axesGroup = this.svg.append("g").style("opacity", 0);

    // X-axis (countries) - positioned at TOP with margin
    this.xAxisGroup = this.axesGroup
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${this.margin.top})`)
      .call(d3.axisTop(this.xScale));

    // Rotate x-axis labels
    this.xAxisGroup
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "start")
      // .attr("dx", "-.5em")
      .attr("dy", "1em")
      .style("font-size", "11px")
      .style("fill", "#666");

    // Y-axis (names) - labels inside chart on the right
    this.yAxisGroup = this.axesGroup
      .append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(this.yScale));

    // Remove all axis lines and tick marks (we'll add gridlines separately)
    this.axesGroup.selectAll(".domain").remove();
    this.axesGroup.selectAll(".tick line").remove();

    // Style y-axis text (right-aligned on the chart)
    this.yAxisGroup
      .selectAll(".tick text")
      .attr("x", this.width - this.margin.right)
      .style("text-anchor", "start")
      .style("font-size", "11px")
      .style("fill", "#666");

    // Add gridlines
    this.gridlinesGroup = this.axesGroup.append("g").attr("class", "gridlines");

    // Vertical gridlines (from x-axis labels down)
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

    // Horizontal gridlines (from y-axis labels across)
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

  setupLegend() {
    // Legend positioned in top-left corner with margin
    const legendX = 10;
    const legendY = this.margin.top / 3;

    this.legendGroup = this.svg
      .append("g")
      .attr("class", "color-legend")
      .attr("transform", `translate(${legendX}, ${legendY})`)
      .style("opacity", 0); // Initially hidden, shows with scatter view

    // Legend title
    this.legendGroup
      .append("text")
      .attr("x", 0)
      .attr("y", -5)
      .style("font-size", "14px")
      .style("font-weight", "700")
      .style("fill", "#333")
      .text("Deal type");

    // Legend items
    this.types.forEach((type, i) => {
      const group = this.legendGroup
        .append("g")
        .attr("transform", `translate(0, ${i * 20})`);

      // Circle
      group
        .append("circle")
        .attr("cx", 6)
        .attr("cy", 8)
        .attr("r", 6)
        .attr("fill", this.colorScale(type))
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5);

      // Label
      group
        .append("text")
        .attr("x", 18)
        .attr("y", 12)
        .style("font-size", "11px")
        .style("fill", "#333")
        .text(type);
    });
  }

  setupDataPoints() {
    // Create dots from geojson features
    // Use lon/lat from properties instead of calculating centroids
    this.dots = this.svg
      .selectAll(".trade-dot")
      .data(this.geoData.features)
      .enter()
      .append("circle")
      .attr("class", "trade-dot")
      .attr("r", 6)
      .attr("cx", (d) => {
        const [x, y] = this.projection([d.properties.lon, d.properties.lat]);
        return x;
      })
      .attr("cy", (d) => {
        const [x, y] = this.projection([d.properties.lon, d.properties.lat]);
        return y;
      })
      .attr("fill", "#595959")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .style("opacity", 1)
      .style("pointer-events", "none") // Start disabled, enable in scatter view
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
      // Scatter view: show country, name (no type line)
      this.tooltip
        .style("opacity", 1)
        .html(
          `
        <strong>${props.country}</strong><br/>
        ${props.name}
      `,
        )
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 10 + "px");
    } else {
      // Map view: show only country name
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
    // Update SVG size
    this.svg.attr("width", this.width).attr("height", this.height);

    // Update projection
    this.projection
      .scale(this.width / 6)
      .translate([this.width / 2, this.height / 2]);

    // Update scales
    this.xScale.range([this.margin.left, this.width - this.margin.right]);
    this.yScale.range([
      this.margin.top,
      this.scatterOffsetY + this.scatterHeight,
    ]);

    // Update map
    this.land.attr("d", this.path);
    this.countriesGroup.selectAll(".trade-country").attr("d", this.path);

    // Update axes
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

    // Remove all axis lines and tick marks
    this.axesGroup.selectAll(".domain").remove();
    this.axesGroup.selectAll(".tick line").remove();

    // Re-style y-axis text
    this.yAxisGroup
      .selectAll(".tick text")
      .attr("x", this.width - this.margin.right)
      .style("text-anchor", "start")
      .style("font-size", "11px")
      .style("fill", "#666");

    // Update gridlines
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

    // Update dot positions based on current view
    if (this.isScatterView) {
      this.dots
        .attr("cx", (d) => this.xScale(d.properties.country))
        .attr("cy", (d) => this.yScale(d.properties.name));
    } else {
      this.dots
        .attr("cx", (d) => {
          const [x, y] = this.projection([d.properties.lon, d.properties.lat]);
          return x;
        })
        .attr("cy", (d) => {
          const [x, y] = this.projection([d.properties.lon, d.properties.lat]);
          return y;
        });
    }
  }

  toggleView(isScatter, step) {
    this.isScatterView = isScatter;

    if (isScatter) {
      // Transition to scatter view
      this.dots
        .transition()
        .duration(1000)
        .attr("cx", (d) => this.xScale(d.properties.country))
        .attr("cy", (d) => this.yScale(d.properties.name))
        .attr("r", 8)
        .attr("fill", (d) => this.colorScale(d.properties.type))
        .style("opacity", 1);

      // Fade out map, fade in axes
      this.mapGroup.transition().duration(1000).style("opacity", 0);
      this.axesGroup.transition().duration(1000).style("opacity", 1);
    } else {
      // Transition back to map view
      this.dots
        .transition()
        .duration(1000)
        .attr("cx", (d) => {
          const [x, y] = this.projection([d.properties.lon, d.properties.lat]);
          return x;
        })
        .attr("cy", (d) => {
          const [x, y] = this.projection([d.properties.lon, d.properties.lat]);
          return y;
        })
        .attr("r", 6)
        .attr("fill", "#595959")
        .style("opacity", 1);

      // Fade in map, fade out axes
      this.mapGroup.transition().duration(1000).style("opacity", 1);
      this.axesGroup.transition().duration(1000).style("opacity", 0);
    }
  }

  // highlight method
  highlightTypeByStep(step) {
    const activeType = this.stepTypeMap[step];

    if (!activeType) {
      // Reset: show all dots equally
      this.dots.transition().duration(400).style("opacity", 1).attr("r", 8);

      return;
    }

    this.dots
      .transition()
      .duration(400)
      .style("opacity", (d) => (d.properties.type === activeType ? 1 : 0.15))
      .attr("r", (d) => (d.properties.type === activeType ? 10 : 6));
  }

  // Scroll-based transition with progress value (0-1)
  setTransitionProgress(isScatter, progress) {
    // Clamp progress between 0 and 1
    progress = Math.max(0, Math.min(1, progress));

    this.isScatterView = isScatter;

    if (isScatter) {
      // Interpolate from map to scatter view
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
        .attr("r", (d) => {
          return d3.interpolate(6, 8)(progress);
        })
        .attr("fill", (d) => {
          const startColor = "#595959";
          const endColor = this.colorScale(d.properties.type);
          return d3.interpolate(startColor, endColor)(progress);
        })
        .style("opacity", 1);

      // Fade out map, fade in axes and legend
      this.mapGroup.style("opacity", 1 - progress);
      this.axesGroup.style("opacity", progress);
      this.legendGroup.style("opacity", progress);

      // Toggle pointer events: enable dots, disable country features
      if (progress > 0.5) {
        this.dots.style("pointer-events", "auto");
        this.countriesGroup
          .selectAll(".trade-country")
          .style("pointer-events", "none");
      }
    } else {
      // Interpolate from scatter to map view
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
        .attr("r", (d) => {
          return d3.interpolate(8, 6)(progress);
        })
        .attr("fill", (d) => {
          const startColor = this.colorScale(d.properties.type);
          const endColor = "#595959";
          return d3.interpolate(startColor, endColor)(progress);
        })
        .style("opacity", 1);

      // Fade in map, fade out axes and legend
      this.mapGroup.style("opacity", progress);
      this.axesGroup.style("opacity", 1 - progress);
      this.legendGroup.style("opacity", 1 - progress);

      // Toggle pointer events: enable country features, disable dots
      if (progress > 0.5) {
        this.dots.style("pointer-events", "none");
        this.countriesGroup
          .selectAll(".trade-country")
          .style("pointer-events", "auto");
      }
    }
  }

  // Calculate scroll progress for a card (0 = entering viewport, 1 = leaving viewport)
  calculateScrollProgress(card) {
    const rect = card.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Card enters at bottom of viewport (progress = 0)
    // Card exits at top of viewport (progress = 1)
    // We want the transition to happen as the card scrolls through the viewport

    const cardTop = rect.top;
    const cardHeight = rect.height;

    // Start transition when card is 80vh from top, complete when it reaches 20vh from top
    const startY = viewportHeight * 0.8;
    const endY = viewportHeight * 0.2;

    let progress = (startY - cardTop) / (startY - endY);

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, progress));
  }

  // Update animation based on current scroll position
  updateScrollAnimation() {
    if (!this.scrollAnimationActive || !this.currentTransitionCard) {
      return;
    }

    const progress = this.calculateScrollProgress(this.currentTransitionCard);

    if (this.transitionDirection === "toScatter") {
      this.setTransitionProgress(true, progress);
    } else if (this.transitionDirection === "toMap") {
      this.setTransitionProgress(false, progress);
    }

    // Continue animating
    this.rafId = requestAnimationFrame(() => this.updateScrollAnimation());
  }

  // Start scroll-bound animation
  startScrollAnimation(card, direction) {
    // Stop any existing animation
    this.stopScrollAnimation();

    this.scrollAnimationActive = true;
    this.currentTransitionCard = card;
    this.transitionDirection = direction; // 'toScatter' or 'toMap'

    // Start animation loop
    this.updateScrollAnimation();
  }

  // Stop scroll-bound animation
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
