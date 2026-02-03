import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";
import { CONFIG } from "./config.js";

export class ForcesAreaChart {
  constructor(container) {
    this.container = container;

    // Get container dimensions - 50% width
    this.width = Math.round(container.clientWidth * 0.5);
    this.height = window.innerHeight * 0.8;

    this.margin = { top: 60, right: 200, bottom: 60, left: 80 };

    this.init();

    window.addEventListener("resize", () => {
      this.width = Math.round(container.clientWidth * 0.5);
      this.height = window.innerHeight * 0.8;
      this.resize();
    });
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
      .attr("class", "viz-title-narrow")
      .attr("x", this.margin.left)
      .attr("y", 20) // Distance from top of SVG
      // .attr("text-anchor", "start")
      .text("US personnel in Europe over time");
  }

  async loadData() {
    try {
      const data = await d3.csv(`${CONFIG.BASE_URL}/forces_total.csv`, (d) => ({
        date: d3.timeParse("%Y-%m-%d")(d.date),
        name: d.name,
        value: +d.value,
      }));

      this.data = data;

      // Get unique categories
      this.categories = [...new Set(data.map((d) => d.name))];

      // Group data by date
      const dataByDate = d3.group(data, (d) => d.date.getTime());
      this.dates = Array.from(dataByDate.keys())
        .map((d) => new Date(d))
        .sort((a, b) => a - b);

      // Create properly formatted data for stacking
      this.formattedData = this.dates.map((date) => {
        const dateData = { date };
        const entries = dataByDate.get(date.getTime());
        entries.forEach((entry) => {
          dateData[entry.name] = entry.value;
        });
        return dateData;
      });

      // Create stack generator
      this.stack = d3.stack().keys(this.categories);

      this.stackedData = this.stack(this.formattedData);

      console.log("Forces data loaded:", {
        rows: data.length,
        categories: this.categories.length,
        dates: this.dates.length,
      });
    } catch (error) {
      console.error("Error loading data:", error);
      throw error;
    }
  }

  setupScales() {
    // const maxDate = d3.max(this.dates, (layer) => d3.max(layer, (d) => d[1]));
    const maxDate = d3.extent(this.dates);

    // X scale (time)
    this.xScale = d3
      .scaleTime()
      .domain(d3.extent(this.dates))
      .range([this.margin.left, this.width - this.margin.right]);

    // Y scale (values)
    const maxValue = d3.max(this.stackedData, (layer) =>
      d3.max(layer, (d) => d[1]),
    );

    this.yScale = d3
      .scaleLinear()
      .domain([0, maxValue])
      .range([this.height - this.margin.bottom, this.margin.top])
      .nice();
  }

  setupColorScale() {
    this.colorScale = d3
      .scaleOrdinal()
      .domain(this.categories)
      .range(["#309ebe", "#595959", "#c6c6c6"]);
  }

  createSVG() {
    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("viewBox", `0 0 ${this.width} ${this.height}`)
      .style("width", "100%")
      .style("height", "100%");
  }

  setupElements() {
    // Create main chart group
    this.chartGroup = this.svg.append("g");

    // Setup legend
    // this.setupLegend();

    // Setup axes
    this.setupAxes();

    // Draw area chart
    this.drawAreas();
    // Draw area labels
    this.drawAreaLabels();
  }

  setupLegend() {
    const legendGroup = this.svg
      .append("g")
      .attr("class", "legend")
      .attr(
        "transform",
        `translate(${this.width - this.margin.right + 20}, ${this.margin.top})`,
      );

    this.categories.forEach((category, i) => {
      const group = legendGroup
        .append("g")
        .attr("transform", `translate(0, ${i * 22})`);

      // Circle
      group
        .append("circle")
        .attr("cx", 6)
        .attr("cy", 8)
        .attr("r", 6)
        .attr("fill", this.colorScale(category));

      // Text
      group
        .append("text")
        .attr("x", 18)
        .attr("y", 12)
        .style("font-size", "11px")
        .style("fill", "#333")
        .text(category);
    });
  }

  setupAxes() {
    // X axis (time)
    this.xAxisGroup = this.svg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${this.height - this.margin.bottom})`)
      .call(d3.axisBottom(this.xScale).ticks(6));

    // Y axis (values)
    this.yAxisGroup = this.svg
      .append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${this.margin.left}, 0)`)
      .call(d3.axisLeft(this.yScale).ticks(6));

    // Remove axis domain lines
    this.svg.selectAll(".domain").remove();

    // Style ticks
    this.svg
      .selectAll(".tick line")
      .attr("stroke", "#999")
      .attr("stroke-width", 1);

    this.svg
      .selectAll(".tick text")
      .style("font-size", "11px")
      .style("fill", "#666");
  }

  drawAreas() {
    // Create area generator with Catmull-Rom smoothing
    const area = d3
      .area()
      .x((d) => this.xScale(d.data.date))
      .y0((d) => this.yScale(d[0]))
      .y1((d) => this.yScale(d[1]))
      .curve(d3.curveCatmullRom); // Catmull-Rom smoothing

    this.areasGroup = this.chartGroup
      .selectAll(".layer")
      .data(this.stackedData)
      .enter()
      .append("g")
      .attr("class", "layer");

    this.areasGroup
      .append("path")
      .attr("class", "area")
      .attr("d", area)
      .attr("fill", (d) => this.colorScale(d.key))
      .style("opacity", 1)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => this.showTooltip(event, d))
      .on("mousemove", (event, d) => this.updateTooltip(event, d))
      .on("mouseout", () => this.hideTooltip());
  }

  drawAreaLabels() {
    const midDate = new Date(
      (this.dates[0].getTime() + this.dates[this.dates.length - 1].getTime()) /
        2,
    );

    const maxDate = new Date(d3.max(this.dates).getTime());

    this.labelsGroup = this.chartGroup
      .selectAll(".area-label")
      .data(this.stackedData)
      .enter()
      .append("text")
      .attr("class", "area-label")
      .attr("text-anchor", "start")
      .attr("dominant-baseline", "middle")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .attr("fill", (d) => this.colorScale(d.key))
      .style("pointer-events", "none")
      .attr("x", this.xScale(maxDate))
      .attr("y", (layer) => {
        // find closest point to maxDate
        const bisect = d3.bisector((d) => d.data.date).left;
        const i = bisect(layer, maxDate);
        const d = layer[i] || layer[layer.length - 1];

        // vertical midpoint of the stacked area
        return this.yScale((d[0] + d[1]) / 2);
      })
      .attr("dx", "1em")
      // .attr("dy", "1em")
      .text((d) => d.key);
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
    const name = d.key;

    // Find closest date point
    const mouseX = d3.pointer(event, this.svg.node())[0];
    const xDate = this.xScale.invert(mouseX);

    // Find closest data point
    const bisect = d3.bisector((d) => d.data.date).left;
    const index = bisect(d, xDate);
    const dataPoint = d[index] || d[d.length - 1];

    const value = dataPoint.data[name];

    this.tooltip
      .style("opacity", 1)
      .html(`<strong>${name}</strong><br/>${value.toLocaleString()}`)
      .style("left", event.pageX + 10 + "px")
      .style("top", event.pageY - 10 + "px");
  }

  updateTooltip(event, d) {
    this.showTooltip(event, d);
  }

  hideTooltip() {
    this.tooltip.style("opacity", 0);
  }

  resize() {
    // Update SVG size
    this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);

    // Update scales
    this.xScale.range([this.margin.left, this.width - this.margin.right]);
    this.yScale.range([this.height - this.margin.bottom, this.margin.top]);

    // Update axes
    this.xAxisGroup
      .attr("transform", `translate(0, ${this.height - this.margin.bottom})`)
      .call(d3.axisBottom(this.xScale).ticks(6));

    this.yAxisGroup.call(d3.axisLeft(this.yScale).ticks(6));

    // Update legend position
    this.svg
      .select(".legend")
      .attr(
        "transform",
        `translate(${this.width - this.margin.right + 20}, ${this.margin.top})`,
      );

    // Update area paths
    const area = d3
      .area()
      .x((d) => this.xScale(d.data.date))
      .y0((d) => this.yScale(d[0]))
      .y1((d) => this.yScale(d[1]))
      .curve(d3.curveCatmullRom);

    this.chartGroup.selectAll(".area").attr("d", area);

    if (this.labelsGroup) {
      const midDate = new Date(
        (this.dates[0].getTime() +
          this.dates[this.dates.length - 1].getTime()) /
          2,
      );

      this.labelsGroup.attr("x", this.xScale(midDate)).attr("y", (layer) => {
        const bisect = d3.bisector((d) => d.data.date).left;
        const i = bisect(layer, midDate);
        const d = layer[i] || layer[layer.length - 1];
        return this.yScale((d[0] + d[1]) / 2);
      });
    }
  }
}

export default ForcesAreaChart;
