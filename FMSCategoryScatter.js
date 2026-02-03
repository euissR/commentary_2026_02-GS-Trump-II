import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";
import { CONFIG } from "./config.js";

export class FMSCategoryScatter {
  constructor(container) {
    this.container = container;

    // Get container dimensions - matching DotMapPlot pattern
    const containerRect = container.getBoundingClientRect();
    this.width = Math.floor(containerRect.width);
    // this.height = Math.min(this.width, window.innerHeight * 0.9);
    this.height = this.width; // Square layout

    this.legendWidth = 220;
    this.margin = { top: 200, right: this.legendWidth, bottom: 20, left: 0 };

    this.init();

    window.addEventListener("resize", () => {
      const containerRect = this.container.getBoundingClientRect();
      this.width = Math.floor(containerRect.width);
      this.height = this.width; // Square layout
      this.resize();
    });

    this.legendOrder = [
      "EU Member State",
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
  }

  async loadData() {
    try {
      const data = await d3.csv(`${CONFIG.BASE_URL}/fms_cat_eu.csv`, (d) => ({
        country: d.country,
        name: d.name,
        value: +d.value,
        fill: d.fill,
      }));

      this.data = data;

      const sumByCountry = d3.rollup(
        data,
        (v) => d3.sum(v, (d) => d.value),
        (d) => d.country,
      );

      const countriesByGroup = d3.group(data, (d) => d.fill);

      this.countries = this.legendOrder.flatMap((group) =>
        [
          ...new Set((countriesByGroup.get(group) || []).map((d) => d.country)),
        ].sort((a, b) =>
          d3.descending(sumByCountry.get(a), sumByCountry.get(b)),
        ),
      );

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
    this.xScale = d3
      .scalePoint()
      .domain(this.names)
      .range([this.margin.left, this.width - this.margin.right])
      .padding(0.5);

    this.yScale = d3
      .scalePoint()
      .domain(this.countries)
      .range([this.margin.top, this.height - this.margin.bottom])
      .padding(0.5);

    const maxValue = d3.max(this.data, (d) => d.value);
    this.sizeScale = d3.scaleSqrt().domain([0, maxValue]).range([0, 20]);
  }

  setupColorScale() {
    this.colorScale = d3
      .scaleOrdinal()
      .domain(this.legendOrder)
      .range(["#309ebe", "#1d3956", "#c6c6c6"]);
  }

  createSVG() {
    // Use viewBox for proper scaling (like DotMapPlot)
    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("viewBox", `0 0 ${this.width} ${this.height}`)
      .style("width", "100%")
      .style("height", "100%");
    // to prevent scaling down of svg to fit container
    // .attr("width", this.width)
    // .attr("height", this.height);
  }

  setupElements() {
    this.setupAxes();
    this.setupLegend();
    this.setupGridlines();
    this.setupDataPoints();
  }

  setupAxes() {
    this.axesGroup = this.svg.append("g");

    this.xAxisGroup = this.axesGroup
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${this.margin.top})`)
      .call(d3.axisTop(this.xScale));

    this.xAxisGroup
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "start")
      .attr("dx", "1em")
      .attr("dy", "-.25em")
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
  }

  setupLegend() {
    const legendX = this.width - this.legendWidth;
    const titleY = this.margin.top - 120;
    this.legendY = this.margin.top - 110;

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
      .text("European FMS purchases in 2025");

    this.legendGroup = this.svg
      .append("g")
      .attr("class", "color-legend")
      .attr("transform", `translate(${legendX}, ${this.legendY})`);

    this.legendOrder.forEach((category, i) => {
      const g = this.legendGroup
        .append("g")
        .attr("transform", `translate(0, ${22 + i * 20})`);

      g.append("text")
        .attr("x", this.legendWidth - 24)
        .attr("y", 9)
        .attr("text-anchor", "end")
        .style("font-size", "11px")
        .style("fill", "#333")
        .text(category);

      g.append("circle")
        .attr("cx", this.legendWidth - 10)
        .attr("cy", 6)
        .attr("r", 6)
        .attr("fill", this.colorScale(category))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);
    });
  }

  setupGridlines() {
    this.gridlinesGroup = this.svg.append("g").attr("class", "gridlines");

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
      .data(this.data.filter((d) => d.value > 0))
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
    this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);
    // to prevent scaling down of svg to fit container
    // this.svg.attr("width", this.width).attr("height", this.height);

    this.xScale.range([this.margin.left, this.width - this.margin.right]);
    this.yScale.range([this.margin.top, this.height - this.margin.bottom]);

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

    this.axesGroup.selectAll(".domain").remove();
    this.axesGroup.selectAll(".tick line").remove();

    this.yAxisGroup
      .selectAll(".tick text")
      .attr("x", this.width - this.legendWidth - 10)
      .style("text-anchor", "end")
      .style("font-size", "11px")
      .style("fill", "#666");

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

    this.dots
      .attr("cx", (d) => this.xScale(d.name))
      .attr("cy", (d) => this.yScale(d.country));

    const legendX = this.width - this.legendWidth;
    this.titleText.attr("x", legendX + this.legendWidth - 12);
    this.legendGroup.attr(
      "transform",
      `translate(${legendX}, ${this.legendY})`,
    );
  }
}

export default FMSCategoryScatter;
