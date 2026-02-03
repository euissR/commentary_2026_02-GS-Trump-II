import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";
import { CONFIG } from "./config.js";

export class ForcesAreaChart {
  constructor(container) {
    this.isMobile = window.innerWidth <= 768;
    this.container = container;

    // Get container dimensions - 50% width, right-aligned
    const containerRect = container.getBoundingClientRect();
    this.width = Math.round(containerRect.width * 0.5);
    this.height = window.innerHeight * 0.66;

    this.margin = { top: 60, right: 150, bottom: 60, left: 80 };

    this.init();

    window.addEventListener("resize", () => {
      const containerRect = this.container.getBoundingClientRect();
      this.width = Math.round(containerRect.width * 0.5);
      this.height = window.innerHeight * 0.66;
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

    this.titleText = this.svg
      .append("text")
      .attr("class", "viz-title-narrow")
      .attr("x", this.margin.left)
      .attr("y", 20)
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
      this.categories = [...new Set(data.map((d) => d.name))];

      const dataByDate = d3.group(data, (d) => d.date.getTime());
      this.dates = Array.from(dataByDate.keys())
        .map((d) => new Date(d))
        .sort((a, b) => a - b);

      this.formattedData = this.dates.map((date) => {
        const dateData = { date };
        const entries = dataByDate.get(date.getTime());
        entries.forEach((entry) => {
          dateData[entry.name] = entry.value;
        });
        return dateData;
      });

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
    this.xScale = d3
      .scaleTime()
      .domain(d3.extent(this.dates))
      .range([this.margin.left, this.width - this.margin.right]);

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
    // Use viewBox and right-align with margin-left: auto
    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("viewBox", `0 0 ${this.width} ${this.height}`)
      .style("width", this.isMobile ? "90%" : "50%")
      .style("height", "66vh")
      .style("margin-left", "auto");
  }

  setupElements() {
    this.chartGroup = this.svg.append("g");
    this.setupAxes();
    this.drawAreas();
    this.drawAreaLabels();
  }

  setupAxes() {
    this.xAxisGroup = this.svg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${this.height - this.margin.bottom})`)
      .call(d3.axisBottom(this.xScale).ticks(6));

    this.yAxisGroup = this.svg
      .append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${this.margin.left}, 0)`)
      .call(d3.axisLeft(this.yScale).ticks(6));

    this.svg.selectAll(".domain").remove();
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
    const area = d3
      .area()
      .x((d) => this.xScale(d.data.date))
      .y0((d) => this.yScale(d[0]))
      .y1((d) => this.yScale(d[1]))
      .curve(d3.curveCatmullRom);

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
        const bisect = d3.bisector((d) => d.data.date).left;
        const i = bisect(layer, maxDate);
        const d = layer[i] || layer[layer.length - 1];
        return this.yScale((d[0] + d[1]) / 2);
      })
      .attr("dx", "0.5em")
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
    const mouseX = d3.pointer(event, this.svg.node())[0];
    const xDate = this.xScale.invert(mouseX);
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
    this.isMobile = window.innerWidth <= 768;
    this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);

    this.xScale.range([this.margin.left, this.width - this.margin.right]);
    this.yScale.range([this.height - this.margin.bottom, this.margin.top]);

    this.xAxisGroup
      .attr("transform", `translate(0, ${this.height - this.margin.bottom})`)
      .call(d3.axisBottom(this.xScale).ticks(6));

    this.yAxisGroup.call(d3.axisLeft(this.yScale).ticks(6));

    const area = d3
      .area()
      .x((d) => this.xScale(d.data.date))
      .y0((d) => this.yScale(d[0]))
      .y1((d) => this.yScale(d[1]))
      .curve(d3.curveCatmullRom);

    this.chartGroup.selectAll(".area").attr("d", area);

    if (this.labelsGroup) {
      const maxDate = new Date(d3.max(this.dates).getTime());
      this.labelsGroup.attr("x", this.xScale(maxDate)).attr("y", (layer) => {
        const bisect = d3.bisector((d) => d.data.date).left;
        const i = bisect(layer, maxDate);
        const d = layer[i] || layer[layer.length - 1];
        return this.yScale((d[0] + d[1]) / 2);
      });
    }
  }
}

export default ForcesAreaChart;
