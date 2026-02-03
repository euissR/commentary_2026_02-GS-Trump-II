import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";
import { CONFIG } from "./config.js";

export class FMSRegionChart {
  constructor(container) {
    this.container = container;

    // Get container dimensions - 50% width
    const body = container.closest(".field--name-body");
    const rect = body.getBoundingClientRect();

    this.width = rect.width * 0.5;
    this.height = Math.min(this.width * 0.9, window.innerHeight * 0.8);

    this.margin = { top: 200, right: 0, bottom: 200, left: 80 };

    this.init();

    window.addEventListener("resize", () => {
      const body = container.closest(".field--name-body");
      const rect = body.getBoundingClientRect();

      this.width = rect.width * 0.5;
      this.height = Math.min(this.width * 0.9, window.innerHeight * 0.8);
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
      .attr("class", "viz-title")
      .attr("x", this.margin.left)
      .attr("y", 20) // Distance from top of SVG
      .text("US foreign military sales");
  }

  async loadData() {
    try {
      const data = await d3.csv(
        `${CONFIG.BASE_URL}/fms_region_long.csv`,
        (d) => ({
          region: d.region,
          date: +d.date, // Numeric year
          value: +d.value,
        }),
      );

      this.data = data;

      // Get unique regions
      this.regions = [...new Set(data.map((d) => d.region))];

      // Get unique dates
      this.dates = [...new Set(data.map((d) => d.date))].sort((a, b) => a - b);

      // Create properly formatted data for stacking
      const dataByDate = d3.group(data, (d) => d.date);
      this.formattedData = this.dates.map((date) => {
        const dateData = { date };
        const entries = dataByDate.get(date) || [];
        entries.forEach((entry) => {
          dateData[entry.region] = entry.value;
        });
        // Fill missing regions with 0
        this.regions.forEach((region) => {
          if (!(region in dateData)) {
            dateData[region] = 0;
          }
        });
        return dateData;
      });

      // Create stack generator
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
    // X scale (years) - use scaleBand for bars
    this.xScale = d3
      .scaleBand()
      .domain(this.dates)
      .range([this.margin.left, this.width - this.margin.right])
      .padding(0.1);

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
    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("width", this.width)
      .attr("height", this.height)
      .style("margin-left", "auto"); // Right-align
  }

  setupElements() {
    // Create main chart group
    this.chartGroup = this.svg.append("g");

    // Setup legend
    this.setupLegend();

    // Setup axes
    this.setupAxes();

    // Draw bars
    this.drawBars();
  }

  setupLegend() {
    const itemsPerRow = 3;
    const rowHeight = 20;
    const colWidth = this.width / 6 < 100 ? 100 : this.width / 6; // adjust for label length

    const legendGroup = this.svg
      .append("g")
      .attr("class", "legend")
      .attr(
        "transform",
        `translate(${this.margin.left + 20}, ${
          this.margin.top - rowHeight * 3
        })`,
      );

    this.regions.forEach((region, i) => {
      const col = i % itemsPerRow;
      const row = Math.floor(i / itemsPerRow);

      const group = legendGroup
        .append("g")
        .attr("transform", `translate(${col * colWidth}, ${row * rowHeight})`);

      // Circle
      group
        .append("circle")
        .attr("cx", 6)
        .attr("cy", 8)
        .attr("r", 6)
        .attr("fill", this.colorScale(region));

      // Text
      group
        .append("text")
        .attr("x", 18)
        .attr("y", 12)
        .style("font-size", "11px")
        .style("fill", "#333")
        .text(region);
    });
  }

  setupAxes() {
    const yearTicks = [2017, 2020, 2025];

    // X axis (years)
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
        // Get the layer (region) data from the parent node
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
      .html(`<strong>${region}</strong><br/>${value.toFixed(1)}`)
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
        if (!target) return 1; // no target → full opacity

        const region = d3.select(this).attr("data-region");
        const date = +d3.select(this).attr("data-date");
        const isMatch =
          target.regions.includes(region) && target.dates.includes(date);
        return isMatch ? 1 : 0.5;
      });
  }

  resize() {
    // Update SVG size
    this.svg.attr("width", this.width).attr("height", this.height);

    // Update scales
    this.xScale.range([this.margin.left, this.width - this.margin.right]);
    this.yScale.range([this.height - this.margin.bottom, this.margin.top]);

    // Update axes
    this.xAxisGroup
      .attr("transform", `translate(0, ${this.height - this.margin.bottom})`)
      .call(
        d3
          .axisBottom(this.xScale)
          .tickValues([2017, 2020, 2025])
          .tickFormat(d3.format("d")),
      );

    this.yAxisGroup.call(d3.axisLeft(this.yScale).ticks(6));

    // Update legend position
    this.svg
      .select(".legend")
      .attr(
        "transform",
        `translate(${this.width - this.margin.right + 20}, ${this.margin.top})`,
      );

    // Update bar positions and heights
    this.chartGroup
      .selectAll(".fms-bar")
      .attr("x", (d) => this.xScale(d.data.date))
      .attr("y", (d) => this.yScale(d[1]))
      .attr("width", this.xScale.bandwidth())
      .attr("height", (d) => this.yScale(d[0]) - this.yScale(d[1]));
  }
}

export default FMSRegionChart;
