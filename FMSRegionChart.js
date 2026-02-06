import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";
import { CONFIG } from "./config.js";

export class FMSRegionChart {
  constructor(container) {
    this.isMobile = window.innerWidth <= 768;
    this.container = container;

    // Get container dimensions - 50% width, 66% height, right-aligned
    const containerRect = container.getBoundingClientRect();
    this.width = this.isMobile
      ? window.innerWidth * 0.9
      : Math.round(containerRect.width * 0.5);
    this.height = window.innerHeight * 0.66;

    this.margin = this.isMobile
      ? { top: 80, right: 20, bottom: 60, left: 60 }
      : { top: 100, right: 20, bottom: 60, left: 80 };

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
      .text("US foreign military sales");
  }

  async loadData() {
    try {
      const data = await d3.csv(
        `${CONFIG.BASE_URL}/fms_region_long.csv`,
        (d) => ({
          region: d.region,
          date: +d.date,
          value: +d.value,
        }),
      );

      this.data = data;
      this.regions = [...new Set(data.map((d) => d.region))];
      this.dates = [...new Set(data.map((d) => d.date))].sort((a, b) => a - b);

      const dataByDate = d3.group(data, (d) => d.date);
      this.formattedData = this.dates.map((date) => {
        const dateData = { date };
        const entries = dataByDate.get(date) || [];
        entries.forEach((entry) => {
          dateData[entry.region] = entry.value;
        });
        this.regions.forEach((region) => {
          if (!(region in dateData)) {
            dateData[region] = 0;
          }
        });
        return dateData;
      });

      this.stack = d3.stack().keys(this.regions);
      this.stackedData = this.stack(this.formattedData);

      console.log("FMS region data loaded:", {
        rows: data.length,
        regions: this.regions.length,
        dates: this.dates.length,
      });
    } catch (error) {
      console.error("Error loading data:", error);
      throw error;
    }
  }

  setupScales() {
    this.xScale = d3
      .scaleBand()
      .domain(this.dates)
      .range([this.margin.left, this.width - this.margin.right])
      .padding(0.1);

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
      .domain(this.regions)
      .range([
        "#33163A",
        "#354765",
        "#407A8F",
        "#5BB0B9",
        "#A2CDA6",
        "#FFDE75",
      ]);
  }

  createSVG() {
    // Use viewBox and right-align with margin-left: auto
    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("viewBox", `0 0 ${this.width} ${this.height}`)
      .style("width", this.isMobile ? "100%" : "50%")
      .style("height", "66vh")
      .style("margin-left", this.isMobile ? "0" : "auto");
  }

  setupElements() {
    this.chartGroup = this.svg.append("g");
    this.setupLegend();
    this.setupAxes();
    this.drawBars();
  }

  setupLegend() {
    const itemsPerRow = 3;
    const rowHeight = 20;
    const colWidth = Math.max(
      100,
      (this.width - this.margin.left - this.margin.right) / itemsPerRow,
    );

    const legendGroup = this.svg
      .append("g")
      .attr("class", "legend")
      .attr(
        "transform",
        `translate(${this.margin.left}, ${this.margin.top - rowHeight * 2 - 10})`,
      );

    this.regions.forEach((region, i) => {
      const col = i % itemsPerRow;
      const row = Math.floor(i / itemsPerRow);

      const group = legendGroup
        .append("g")
        .attr("transform", `translate(${col * colWidth}, ${row * rowHeight})`);

      group
        .append("circle")
        .attr("cx", 6)
        .attr("cy", 8)
        .attr("r", 6)
        .attr("fill", this.colorScale(region));

      group
        .append("text")
        .attr("x", 18)
        .attr("y", 12)
        .style("font-size", "12px")
        .style("fill", "#333")
        .text(region);
    });
  }

  setupAxes() {
    this.xAxisGroup = this.svg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${this.height - this.margin.bottom})`)
      .call(
        d3
          .axisBottom(this.xScale)
          .tickValues([2017, 2020, 2025])
          .tickFormat(d3.format("d")),
      );

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
      .style("font-size", "12px")
      .style("fill", "#666");
  }

  drawBars() {
    this.barsGroup = this.chartGroup
      .selectAll(".layer")
      .data(this.stackedData)
      .enter()
      .append("g")
      .attr("class", "layer")
      .attr("fill", (d) => this.colorScale(d.key));

    this.barsGroup
      .selectAll("rect")
      .data((d) => d)
      .enter()
      .append("rect")
      .attr("class", "fms-bar")
      .attr("data-region", function () {
        return d3.select(this.parentNode).datum().key;
      })
      .attr("data-date", (d) => d.data.date)
      .attr("x", (d) => this.xScale(d.data.date))
      .attr("y", (d) => this.yScale(d[1]))
      .attr("width", this.xScale.bandwidth())
      .attr("height", (d) => this.yScale(d[0]) - this.yScale(d[1]))
      .attr("stroke", "#fff")
      .attr("stroke-width", ".5px")
      .style("opacity", 1)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        const layer = d3.select(event.currentTarget.parentNode).datum();
        this.showTooltip(event, d, layer.key);
      })
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

  showTooltip(event, d, region) {
    const value = d.data[region];
    this.tooltip
      .style("opacity", 1)
      .html(`<strong>${region}</strong><br/>$${value.toFixed(1)} billion`)
      .style("left", event.pageX + 10 + "px")
      .style("top", event.pageY - 10 + "px");
  }

  hideTooltip() {
    this.tooltip.style("opacity", 0);
  }

  highlightRegion(step) {
    const targets = {
      1: { regions: ["Europe"], dates: [2025] },
      2: { regions: ["Europe"], dates: [2023, 2024, 2025] },
    };

    const target = targets[step];

    this.chartGroup
      .selectAll(".fms-bar")
      .transition()
      .duration(500)
      .style("opacity", function () {
        if (!target) return 1;
        const region = d3.select(this).attr("data-region");
        const date = +d3.select(this).attr("data-date");
        const isMatch =
          target.regions.includes(region) && target.dates.includes(date);
        return isMatch ? 1 : 0.5;
      });
  }

  resize() {
    this.isMobile = window.innerWidth <= 768;
    this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);

    this.width = this.isMobile
      ? window.innerWidth * 0.9
      : Math.round(this.container.clientWidth * 0.5);

    this.margin = this.isMobile
      ? { top: 80, right: 20, bottom: 60, left: 60 }
      : { top: 100, right: 20, bottom: 60, left: 80 };

    this.xScale.range([this.margin.left, this.width - this.margin.right]);
    this.yScale.range([this.height - this.margin.bottom, this.margin.top]);

    this.xAxisGroup
      .attr("transform", `translate(0, ${this.height - this.margin.bottom})`)
      .call(
        d3
          .axisBottom(this.xScale)
          .tickValues([2017, 2020, 2025])
          .tickFormat(d3.format("d")),
      );

    this.yAxisGroup.call(d3.axisLeft(this.yScale).ticks(6));

    this.chartGroup
      .selectAll(".fms-bar")
      .attr("x", (d) => this.xScale(d.data.date))
      .attr("y", (d) => this.yScale(d[1]))
      .attr("width", this.xScale.bandwidth())
      .attr("height", (d) => this.yScale(d[0]) - this.yScale(d[1]));
  }
}

export default FMSRegionChart;
