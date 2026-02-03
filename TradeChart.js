import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";
import { CONFIG } from "./config.js";

export class TradeChart {
  constructor(container) {
    this.isMobile = window.innerWidth <= 768;
    this.container = container;

    // Get container dimensions - matching DotMapPlot pattern
    const containerRect = container.getBoundingClientRect();
    this.width = Math.floor(containerRect.width);
    this.height = Math.min(this.width, window.innerHeight * 0.9);

    if (this.isMobile) {
      this.width = this.container.clientWidth * 0.9;
      this.height = window.innerHeight * 0.65;
    }

    this.margin = this.isMobile
      ? { top: 60, right: 20, bottom: 150, left: 80 }
      : { top: 100, right: 180, bottom: 100, left: 80 };

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
    this.setupScales();
    this.setupColorScale();
    this.createSVG();
    this.setupElements();
    this.setupTooltip();
  }

  async loadData() {
    try {
      const volumeData = await d3.csv(
        `${CONFIG.BASE_URL}/trade_vol_long.csv`,
        (d) => ({
          date: d3.timeParse("%Y-%m-%d")(d.date),
          name: d.name,
          value: +d.value,
        }),
      );

      this.volumeData = volumeData;
      this.categories = [...new Set(volumeData.map((d) => d.name))];

      const dataByDate = d3.group(volumeData, (d) => d.date.getTime());
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

      this.stack = d3
        .stack()
        .keys(this.categories)
        .offset(d3.stackOffsetDiverging);
      this.stackedData = this.stack(this.formattedData);

      console.log("Trade data loaded:", {
        volumeRows: volumeData.length,
        categories: this.categories.length,
        dates: this.dates.length,
      });
    } catch (error) {
      console.error("Error loading data:", error);
      throw error;
    }
  }

  setupScales() {
    this.yScale = d3
      .scaleBand()
      .domain(this.dates)
      .range([this.margin.top, this.height - this.margin.bottom])
      .paddingInner(0.05);

    const maxValue = d3.max(this.stackedData, (layer) =>
      d3.max(layer, (d) => d[1]),
    );
    const minValue = d3.min(this.stackedData, (layer) =>
      d3.min(layer, (d) => d[0]),
    );

    this.xScale = d3
      .scaleLinear()
      .domain([minValue, maxValue])
      .range([this.margin.left, this.width - this.margin.right])
      .nice();
  }

  setupColorScale() {
    this.colorScale = d3
      .scaleOrdinal()
      .domain(this.categories)
      .range([
        "#FFDE75",
        "#C6C6C6",
        "#A2CDA6",
        "#354765",
        "#5BB0B9",
        "#33163A",
        "#407A8F",
      ]);
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
    this.chartGroup = this.svg.append("g");
    this.setupLegend();
    this.setupAxes();
    this.drawBars();

    this.titleText = this.svg
      .append("text")
      .attr("class", "viz-title")
      .attr("x", this.width)
      .attr("y", this.isMobile ? 0 : 20)
      .text("US-EU trade balance over time");
  }

  setupLegend() {
    const legendGroup = this.svg
      .append("g")
      .attr("class", "legend")
      .attr(
        "transform",
        `translate(${this.isMobile ? this.margin.left + 12 : this.width - 12}, ${this.isMobile ? this.margin.bottom + 12 : this.height * 0.33})`,
      );

    this.categories.forEach((category, i) => {
      const group = legendGroup
        .append("g")
        .attr("transform", `translate(0, ${i * 22})`);
      group
        .append("circle")
        .attr("cx", 6)
        .attr("cy", 8)
        .attr("r", 6)
        .attr("fill", this.colorScale(category));

      // special handling for long category name on mobile
      const text = group
        .append("text")
        .attr("x", -5)
        .attr("y", 12)
        .style("font-size", "12px")
        .style("fill", "#595959")
        .attr("text-anchor", "end");

      if (category === "Net EU imports from the US") {
        text.append("tspan").text("Net EU imports");
        text
          .append("tspan")
          .attr("x", -5)
          .attr("dy", "1.1em")
          .text("from the US");
      } else {
        text.text(category);
      }
    });

    const explanationY = this.categories.length * 22 + 15;
    legendGroup
      .append("text")
      .attr("x", 0)
      .attr("y", explanationY)
      .attr("text-anchor", "end")
      .style("font-size", "10px")
      .style("fill", "#666")
      .style("font-style", "italic")
      .each(function () {
        const text = d3.select(this);
        const lines = [
          "Positive values indicate net EU exports to the US;",
          "negative values indicate net imports from",
          "the US to the EU.",
        ];
        lines.forEach((line, i) => {
          text
            .append("tspan")
            .attr("x", 0)
            .attr("dy", i === 0 ? 0 : "1.2em")
            .attr("text-anchor", "end")
            .text(line);
        });
      });
  }

  setupAxes() {
    this.xAxisGroup = this.svg
      .append("g")
      .attr("class", "x-axis")
      .attr(
        "transform",
        `translate(0, ${this.height - this.margin.bottom + 20})`,
      )
      .call(d3.axisBottom(this.xScale).ticks(6));

    const tickDates = this.dates.filter((d, i) => i % 6 === 0);

    this.yAxisGroup = this.svg
      .append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${this.margin.left}, 0)`)
      .call(
        d3
          .axisLeft(this.yScale)
          .tickValues(tickDates)
          .tickFormat(d3.timeFormat("%b %Y")),
      );

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
      .attr("class", "trade-bar")
      .attr("x", (d) => this.xScale(d[0]))
      .attr("y", (d) => this.yScale(d.data.date))
      .attr("width", (d) => this.xScale(d[1]) - this.xScale(d[0]))
      .attr("height", this.yScale.bandwidth())
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

  showTooltip(event, d, name) {
    const date = d.data.date;
    const formattedDate = d3.timeFormat("%B %Y")(date);
    const value = d.data[name];

    this.tooltip
      .style("opacity", 1)
      .html(
        `<strong>${name}</strong><br/>€${Math.round(value * 10) / 10} billion<br/><i>${formattedDate}</i>`,
      )
      .style("left", event.pageX + 10 + "px")
      .style("top", event.pageY - 10 + "px");
  }

  hideTooltip() {
    this.tooltip.style("opacity", 0);
  }

  highlightDate(step) {
    this.currentStep = step;
    const targetDates = {
      1: new Date("2025-03-01"),
      2: new Date("2025-09-01"),
    };
    const targetDate = targetDates[step];

    if (targetDate) {
      this.chartGroup
        .selectAll(".trade-bar")
        .transition()
        .duration(500)
        .style("opacity", (d) => {
          const barDate = d.data.date;
          const isMatch =
            barDate.getFullYear() === targetDate.getFullYear() &&
            barDate.getMonth() === targetDate.getMonth();
          return isMatch ? 1 : 0.5;
        });
    } else {
      this.chartGroup
        .selectAll(".trade-bar")
        .transition()
        .duration(500)
        .style("opacity", 1);
    }
  }

  resize() {
    this.isMobile = window.innerWidth <= 768;

    if (this.isMobile) {
      this.width = this.container.clientWidth * 0.9;
      this.height = window.innerHeight * 0.5;
      this.margin = { top: 40, right: 20, bottom: 160, left: 80 };
      this.titleText.attr("y", this.isMobile ? 0 : 20);
    } else {
      this.width = this.container.clientWidth;
      this.height = Math.min(this.width, window.innerHeight * 0.9);
      this.margin = { top: 100, right: 180, bottom: 100, left: 80 };
    }
    this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);

    this.xScale.range([this.margin.left, this.width - this.margin.right]);
    this.yScale.range([this.margin.top, this.height - this.margin.bottom]);

    this.xAxisGroup
      .attr("transform", `translate(0, ${this.height - this.margin.bottom})`)
      .call(d3.axisBottom(this.xScale).ticks(6).tickFormat(d3.format(".2s")));

    const tickDates = this.dates.filter((d, i) => i % 6 === 0);
    this.yAxisGroup.call(
      d3
        .axisLeft(this.yScale)
        .tickValues(tickDates)
        .tickFormat(d3.timeFormat("%b %Y")),
    );

    this.svg
      .select(".legend")
      .attr(
        "transform",
        this.isMobile
          ? `translate(${this.margin.left + 12}, ${this.height * 0.55})`
          : `translate(${this.width - 12}, ${this.height * 0.33})`,
      );

    this.chartGroup
      .selectAll(".trade-bar")
      .attr("x", (d) => this.xScale(d[0]))
      .attr("y", (d) => this.yScale(d.data.date))
      .attr("width", (d) => this.xScale(d[1]) - this.xScale(d[0]))
      .attr("height", this.yScale.bandwidth());

    this.titleText.attr("x", this.width);
  }
}

export default TradeChart;
