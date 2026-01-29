import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";

export class TradeChart {
  constructor(container) {
    this.container = container;

    // Get container dimensions
    const containerRect = container.getBoundingClientRect();
    this.width = containerRect.width;
    this.height = window.innerHeight; // 80vh

    this.margin = { top: 20, right: 180, bottom: 50, left: 80 };

    this.init();

    window.addEventListener("resize", () => {
      const containerRect = container.getBoundingClientRect();
      this.width = containerRect.width;
      this.height = window.innerHeight;
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
      const volumeData = await d3.csv("./trade_vol_long.csv", (d) => ({
        date: d3.timeParse("%Y-%m-%d")(d.date),
        name: d.name,
        value: +d.value,
      }));

      this.volumeData = volumeData;

      // Get unique categories
      this.categories = [...new Set(volumeData.map((d) => d.name))];

      // Group data by date
      const dataByDate = d3.group(volumeData, (d) => d.date.getTime());
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

      // Create stack generator with diverging offset for negative values
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
    // Y scales (time) - vertical axis
    this.yScale = d3
      .scaleTime()
      .domain(d3.extent(this.dates))
      .range([this.margin.top, this.height - this.margin.bottom]);

    // X scales (values) - horizontal axis
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
    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("width", this.width)
      .attr("height", this.height);
  }

  setupElements() {
    // Create main chart group
    this.chartGroup = this.svg.append("g");

    // Setup legend
    this.setupLegend();

    // Setup axes
    this.setupAxes();

    // Draw bar chart
    this.drawBars();
  }

  setupLegend() {
    const legendGroup = this.svg
      .append("g")
      .attr("class", "legend")
      .attr(
        "transform",
        `translate(${this.width - this.width / 2}, ${this.margin.top})`,
      );

    this.categories.forEach((category, i) => {
      const group = legendGroup
        .append("g")
        .attr("transform", `translate(0, ${i * 22})`);

      group
        .append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", this.colorScale(category));

      group
        .append("text")
        .attr("x", 20)
        .attr("y", 12)
        .style("font-size", "11px")
        .style("fill", "#333")
        .text(category);
    });
  }

  setupAxes() {
    // X axis (horizontal - values)
    this.xAxisGroup = this.svg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${this.height - this.margin.bottom})`)
      .call(d3.axisBottom(this.xScale).ticks(6));

    // Y axis (vertical - dates)
    this.yAxisGroup = this.svg
      .append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${this.margin.left}, 0)`)
      .call(
        d3
          .axisLeft(this.yScale)
          .ticks(d3.timeYear.every(1))
          .tickFormat(d3.timeFormat("%Y")),
      );

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
    // Calculate bar height to fill vertical space with no gaps
    const availableHeight = this.height - this.margin.top - this.margin.bottom;
    const barHeight = availableHeight / this.dates.length;

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
      .attr("y", (d) => this.yScale(d.data.date) - barHeight / 2)
      .attr("width", (d) => this.xScale(d[1]) - this.xScale(d[0]))
      .attr("height", barHeight)
      .style("opacity", 1)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        // Get the layer (category) data from the parent node
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
        `
        <strong>${name}</strong><br/>
        €${Math.round(value * 10) / 10} billion<br/>
        <i>${formattedDate}</i>
      `,
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

    // Calculate bar height to fill vertical space with no gaps
    const availableHeight = this.height - this.margin.top - this.margin.bottom;
    const barHeight = availableHeight / this.dates.length;

    // Update axes
    this.xAxisGroup
      .attr("transform", `translate(0, ${this.height - this.margin.bottom})`)
      .call(d3.axisBottom(this.xScale).ticks(6).tickFormat(d3.format(".2s")));

    this.yAxisGroup.call(
      d3
        .axisLeft(this.yScale)
        .ticks(d3.timeYear.every(1))
        .tickFormat(d3.timeFormat("%Y")),
    );

    // Update legend position
    this.svg
      .select(".legend")
      .attr(
        "transform",
        `translate(${this.width - this.margin.right + 20}, ${this.margin.top})`,
      );

    // Update bar positions and heights
    this.chartGroup
      .selectAll(".trade-bar")
      .attr("x", (d) => this.xScale(d[0]))
      .attr("y", (d) => this.yScale(d.data.date) - barHeight / 2)
      .attr("width", (d) => this.xScale(d[1]) - this.xScale(d[0]))
      .attr("height", barHeight);
  }
}

export default TradeChart;
