import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";

export class FMSCategoryScatter {
  constructor(container) {
    this.container = container;

    // Get container dimensions - full width
    const containerRect = container.getBoundingClientRect();
    this.width = Math.min(containerRect.width, window.innerWidth * 0.95);
    this.height = Math.min(this.width * 0.8, window.innerHeight * 0.95);

    this.margin = { top: 200, right: 120, bottom: 20, left: 0 };

    this.init();

    window.addEventListener("resize", () => {
      const containerRect = container.getBoundingClientRect();
      this.width = Math.min(containerRect.width, window.innerWidth * 0.95);
      this.height = Math.min(this.width * 0.8, window.innerHeight * 0.95);
      this.resize();
    });

    this.legendOrder = [
      "EU member state",
      "Other European country",
      "Non-European country",
    ];
  }

  async init() {
    await this.loadData();

    this.setupScales();
    this.setupColorScale();
    this.createSVG();
    this.setupElements();
    this.setupTooltip();

    // Add title
    this.titleText = this.svg
      .append("text")
      .attr("class", "viz-title")
      .attr("x", this.width)
      .attr("y", 20) // Distance from top of SVG
      .text("European FMS purchases in 2025");
  }

  async loadData() {
    try {
      const data = await d3.csv("./fms_cat_eu.csv", (d) => ({
        country: d.country,
        name: d.name,
        value: +d.value,
        fill: d.fill,
      }));

      this.data = data;

      // Build a grouped & ordered country list
      const countriesByGroup = d3.group(data, (d) => d.fill);
      this.countries = this.legendOrder.flatMap((group) =>
        [
          ...new Set((countriesByGroup.get(group) || []).map((d) => d.country)),
        ].sort(),
      );
      // get unique names
      this.names = [...new Set(data.map((d) => d.name))].sort();
      this.fillCategories = [...new Set(data.map((d) => d.fill))];

      console.log("FMS category data loaded:", {
        rows: data.length,
        countries: this.countries.length,
        names: this.names.length,
        fillCategories: this.fillCategories,
      });
    } catch (error) {
      console.error("Error loading data:", error);
      throw error;
    }
  }

  setupScales() {
    // X scale (names/categories)
    this.xScale = d3
      .scalePoint()
      .domain(this.names)
      .range([this.margin.left, this.width - this.margin.right])
      .padding(0.5);

    // Y scale (countries)
    this.yScale = d3
      .scalePoint()
      .domain(this.countries)
      .range([this.margin.top, this.height - this.margin.bottom])
      .padding(0.5);

    // Size scale (value to radius)
    const maxValue = d3.max(this.data, (d) => d.value);
    this.sizeScale = d3.scaleSqrt().domain([0, maxValue]).range([0, 20]); // Max radius of 20px
  }

  setupColorScale() {
    this.colorScale = d3
      .scaleOrdinal()
      // .domain([
      //   "EU member state",
      //   "Other European country",
      //   "Non-European country",
      // ])
      .domain(this.legendOrder)
      .range(["#309ebe", "#1d3956", "#c6c6c6"]); // Adjust colors as needed
  }

  createSVG() {
    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("width", this.width)
      .attr("height", this.height);
  }

  setupElements() {
    // Setup axes
    this.setupAxes();

    // Setup legend
    this.setupLegend();

    // Setup gridlines
    this.setupGridlines();

    // Setup data points
    this.setupDataPoints();
  }

  setupAxes() {
    this.axesGroup = this.svg.append("g");

    // X-axis (categories) - positioned at TOP
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
      .attr("dx", ".25em")
      .attr("dy", ".75em")
      .style("font-size", "11px")
      .style("fill", "#666");

    // Y-axis (countries) - labels on the right
    this.yAxisGroup = this.axesGroup
      .append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(this.yScale));

    // Remove all axis lines and tick marks
    this.axesGroup.selectAll(".domain").remove();
    this.axesGroup.selectAll(".tick line").remove();

    // Style y-axis text (right side of chart)
    this.yAxisGroup
      .selectAll(".tick text")
      .attr("x", this.width - this.margin.right)
      .style("text-anchor", "start")
      .style("font-size", "11px")
      .style("fill", "#666");
  }

  setupLegend() {
    const legendX = 10;
    const legendY = 45;

    this.legendGroup = this.svg
      .append("g")
      .attr("class", "color-legend")
      .attr("transform", `translate(${legendX}, ${legendY})`);

    // Legend title
    this.legendGroup
      .append("text")
      .attr("x", 0)
      .attr("y", -5)
      .style("font-size", "14px")
      .style("font-weight", "700")
      .style("fill", "#333")
      .text("Category");

    // Legend items
    this.legendOrder.forEach((category, i) => {
      const group = this.legendGroup
        .append("g")
        .attr("transform", `translate(0, ${i * 20})`);

      // Circle
      group
        .append("circle")
        .attr("cx", 6)
        .attr("cy", 8)
        .attr("r", 6)
        .attr("fill", this.colorScale(category))
        .attr("opacity", 0.8)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5);

      // Label
      group
        .append("text")
        .attr("x", 18)
        .attr("y", 12)
        .style("font-size", "11px")
        .style("fill", "#333")
        .text(category);
    });
  }

  setupGridlines() {
    this.gridlinesGroup = this.svg.append("g").attr("class", "gridlines");

    // Vertical gridlines (from x-axis labels down)
    this.gridlinesGroup
      .selectAll(".grid-vertical")
      .data(this.names)
      .enter()
      .append("line")
      .attr("class", "grid-vertical")
      .attr("x1", (d) => this.xScale(d))
      .attr("x2", (d) => this.xScale(d))
      .attr("y1", this.margin.top)
      .attr("y2", this.height - this.margin.bottom)
      .attr("stroke", "#c6c6c6")
      .attr("stroke-width", 0.5);

    // Horizontal gridlines (from y-axis labels across)
    this.gridlinesGroup
      .selectAll(".grid-horizontal")
      .data(this.countries)
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
      .selectAll(".fms-dot")
      .data(this.data.filter((d) => d.value > 0)) // Only show non-zero values
      .enter()
      .append("circle")
      .attr("class", "fms-dot")
      .attr("cx", (d) => this.xScale(d.name))
      .attr("cy", (d) => this.yScale(d.country))
      .attr("r", (d) => this.sizeScale(d.value))
      .attr("fill", (d) => this.colorScale(d.fill))
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .style("opacity", 0.8)
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
    this.tooltip
      .style("opacity", 1)
      .html(
        `<strong>${d.country}</strong><br/>${d.name}<br/><i>$${d.value.toFixed(1)} billion</i>`,
      )
      .style("left", event.pageX + 10 + "px")
      .style("top", event.pageY - 10 + "px");
  }

  hideTooltip() {
    this.tooltip.style("opacity", 0);
  }

  resize() {
    // Update SVG size
    this.svg.attr("width", this.width).attr("height", this.height);

    // Update scales
    this.xScale.range([this.margin.left, this.width - this.margin.right]);
    this.yScale.range([this.margin.top, this.height - this.margin.bottom]);

    // Update axes
    this.xAxisGroup
      .attr("transform", `translate(0, ${this.margin.top})`)
      .call(d3.axisTop(this.xScale));

    this.xAxisGroup
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "start")
      .attr("dx", ".25em")
      .attr("dy", ".75em")
      .style("font-size", "11px")
      .style("fill", "#666");

    this.yAxisGroup.call(d3.axisLeft(this.yScale));

    // Remove axis lines
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
      .attr("y2", this.height - this.margin.bottom);

    this.gridlinesGroup
      .selectAll(".grid-horizontal")
      .attr("x1", this.margin.left)
      .attr("x2", this.width - this.margin.right)
      .attr("y1", (d) => this.yScale(d))
      .attr("y2", (d) => this.yScale(d));

    // Update dot positions
    this.dots
      .attr("cx", (d) => this.xScale(d.name))
      .attr("cy", (d) => this.yScale(d.country));
  }
}

export default FMSCategoryScatter;
