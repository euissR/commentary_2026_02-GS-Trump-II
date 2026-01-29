import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";

export class TradeChart {
  constructor(container) {
    this.container = container;

    // Get container dimensions
    const containerRect = container.getBoundingClientRect();
    this.width = containerRect.width;
    this.barHeight = containerRect.width * 1.2; // Initial bar chart height
    this.areaHeight = containerRect.width * 2; // Expanded area chart height

    this.currentView = "bars"; // Track current view
    this.margin = { top: 100, right: 200, bottom: 50, left: 80 };

    this.init();

    window.addEventListener("resize", () => {
      const containerRect = container.getBoundingClientRect();
      this.width = containerRect.width;
      this.barHeight = containerRect.width * 1.2;
      this.areaHeight = containerRect.width * 2;
      this.resize();
    });
  }

  async init() {
    await this.loadData();
    this.setupScales();
    this.setupColorScale();
    this.createSVG();
    this.setupElements();
  }

  async loadData() {
    try {
      const [volumeData, timelineData] = await Promise.all([
        d3.csv("./trade_vol_long.csv", (d) => ({
          date: d3.timeParse("%Y-%m-%d")(d.date),
          name: d.name,
          value: +d.value,
        })),
        d3.csv("./trade_tl.csv", (d) => ({
          event: d.event,
          date: d3.timeParse("%Y-%m-%d")(d.date),
        })),
      ]);

      this.volumeData = volumeData;
      this.timelineData = timelineData;

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

      // Filter for 2025 only
      this.formattedData2025 = this.formattedData.filter(
        (d) => d.date.getFullYear() === 2025,
      );

      // Create stack generators with diverging offset for negative values
      this.stack = d3
        .stack()
        .keys(this.categories)
        .offset(d3.stackOffsetDiverging);

      this.stackedData = this.stack(this.formattedData);
      this.stackedData2025 = this.stack(this.formattedData2025);

      console.log("Trade data loaded:", {
        volumeRows: volumeData.length,
        timelineEvents: timelineData.length,
        categories: this.categories.length,
        dates: this.dates.length,
        dates2025: this.formattedData2025.length,
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
      .range([this.margin.top, this.barHeight - this.margin.bottom]);

    const dates2025 = this.formattedData2025.map((d) => d.date);
    this.yScale2025 = d3
      .scaleTime()
      .domain(d3.extent(dates2025))
      .range([this.margin.top, this.areaHeight - this.margin.bottom]);

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
        "#1d3956",
        "#376882",
        "#64C2C7",
        "#FFDE75",
        "#df3144",
        "#C6C6C6",
        "#309ebe",
        "#33163A",
      ]);
  }

  createSVG() {
    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("width", this.width)
      .attr("height", this.barHeight);
  }

  setupElements() {
    // Create main chart group
    this.chartGroup = this.svg.append("g");

    // Setup legend
    this.setupLegend();

    // Setup axes
    this.setupAxes();

    // Draw initial bar chart
    this.drawBars();

    // Setup annotations group (initially hidden)
    this.setupAnnotations();
  }

  setupLegend() {
    const legendGroup = this.svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${this.margin.left}, 20)`);

    const maxWidth = this.width - this.margin.left - this.margin.right;
    const itemWidth = 180;
    const itemsPerRow = Math.floor(maxWidth / itemWidth);

    this.categories.forEach((category, i) => {
      const row = Math.floor(i / itemsPerRow);
      const col = i % itemsPerRow;

      const group = legendGroup
        .append("g")
        .attr("transform", `translate(${col * itemWidth}, ${row * 22})`);

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
      .attr("transform", `translate(0, ${this.barHeight - this.margin.bottom})`)
      .call(d3.axisBottom(this.xScale).ticks(6).tickFormat(d3.format(".2s")));

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

    // Style axes
    this.svg.selectAll(".domain").attr("stroke", "#ccc");
    this.svg.selectAll(".tick line").attr("stroke", "#ccc");
    this.svg.selectAll(".tick text").style("font-size", "11px");
  }

  drawBars() {
    // Clear existing bars
    this.chartGroup.selectAll(".layer").remove();

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
      .attr("data-id", (d, i, nodes) => {
        // Create unique ID: category_timestamp
        const layer = d3.select(nodes[i].parentNode).datum();
        return `${layer.key}_${d.data.date.getTime()}`;
      })
      .attr("x", (d) => this.xScale(d[0]))
      .attr("y", (d) => this.yScale(d.data.date) - 2)
      .attr("width", (d) => this.xScale(d[1]) - this.xScale(d[0]))
      .attr("height", 4)
      .style("opacity", 1);
  }

  setupAnnotations() {
    this.annotationsGroup = this.svg
      .append("g")
      .attr("class", "annotations")
      .style("opacity", 0);
  }

  resize() {
    // Update SVG size
    const height =
      this.currentView === "bars" ? this.barHeight : this.areaHeight;
    this.svg.attr("width", this.width).attr("height", height);

    // Update scales
    this.xScale.range([this.margin.left, this.width - this.margin.right]);

    if (this.currentView === "bars") {
      this.yScale.range([this.margin.top, this.barHeight - this.margin.bottom]);
      this.xAxisGroup.attr(
        "transform",
        `translate(0, ${this.barHeight - this.margin.bottom})`,
      );

      // Update y-axis to years
      this.yAxisGroup.call(
        d3
          .axisLeft(this.yScale)
          .ticks(d3.timeYear.every(1))
          .tickFormat(d3.timeFormat("%Y")),
      );
    } else {
      this.yScale2025.range([
        this.margin.top,
        this.areaHeight - this.margin.bottom,
      ]);
      this.xAxisGroup.attr(
        "transform",
        `translate(0, ${this.areaHeight - this.margin.bottom})`,
      );

      // Update y-axis to months
      this.yAxisGroup.call(
        d3
          .axisLeft(this.yScale2025)
          .ticks(d3.timeMonth.every(1))
          .tickFormat(d3.timeFormat("%b")),
      );
    }

    // Update axes
    this.xAxisGroup.call(
      d3.axisBottom(this.xScale).ticks(6).tickFormat(d3.format(".2s")),
    );

    // Update bar positions based on current view
    if (this.currentView === "zoomed") {
      const bars2025Ids = new Set();
      this.stackedData2025.forEach((layer) => {
        layer.forEach((d) => {
          bars2025Ids.add(`${layer.key}_${d.data.date.getTime()}`);
        });
      });

      this.chartGroup
        .selectAll(".trade-bar")
        .attr(
          "y",
          function (d) {
            const barId = d3.select(this).attr("data-id");
            if (!bars2025Ids.has(barId)) return d3.select(this).attr("y");

            const layer = d3.select(this.parentNode).datum();
            const match2025 = layer.find(
              (item) => `${layer.key}_${item.data.date.getTime()}` === barId,
            );
            if (match2025) {
              return this.yScale2025(match2025.data.date) - 4;
            }
            return d3.select(this).attr("y");
          }.bind(this),
        )
        .attr("height", 8);
    } else {
      this.chartGroup
        .selectAll(".trade-bar")
        .attr("y", (d) => this.yScale(d.data.date) - 2)
        .attr("height", 4);
    }
  }

  toggleView(isZoomed, step) {
    if (isZoomed && this.currentView === "bars") {
      this.currentView = "zoomed";
      this.transitionTo2025();
    } else if (!isZoomed && this.currentView === "zoomed") {
      this.currentView = "bars";
      this.transitionToAllYears();
    }
  }

  transitionTo2025() {
    // Expand height
    this.svg.transition().duration(1000).attr("height", this.areaHeight);

    // Update x-axis position
    this.xAxisGroup
      .transition()
      .duration(1000)
      .attr(
        "transform",
        `translate(0, ${this.areaHeight - this.margin.bottom})`,
      );

    // Update y-axis to months for 2025
    this.yAxisGroup
      .transition()
      .duration(1000)
      .call(
        d3
          .axisLeft(this.yScale2025)
          .ticks(d3.timeMonth.every(1))
          .tickFormat(d3.timeFormat("%b")),
      );

    // Create a set of 2025 bar IDs for quick lookup
    const bars2025Ids = new Set();
    this.stackedData2025.forEach((layer) => {
      layer.forEach((d) => {
        bars2025Ids.add(`${layer.key}_${d.data.date.getTime()}`);
      });
    });

    // Store reference to yScale2025 for use in transition
    const yScale2025 = this.yScale2025;

    // Transition all bars
    this.chartGroup
      .selectAll(".trade-bar")
      .transition()
      .duration(1000)
      .attr("y", function (d) {
        const barId = d3.select(this).attr("data-id");
        if (!bars2025Ids.has(barId)) {
          // Not in 2025, keep old position but will fade out
          return d3.select(this).attr("y");
        }
        // Use the date from the current data point
        return yScale2025(d.data.date) - 4;
      })
      .attr("height", 80) // Make bars slightly taller in zoomed view
      .attr("dy", 40) // Make bars slightly taller in zoomed view
      .style("opacity", function () {
        const barId = d3.select(this).attr("data-id");
        return bars2025Ids.has(barId) ? 1 : 0;
      });

    // Draw annotations after transition
    setTimeout(() => {
      this.drawAnnotations();
    }, 1000);
  }

  transitionToAllYears() {
    // Collapse height
    this.svg.transition().duration(1000).attr("height", this.barHeight);

    // Update x-axis position
    this.xAxisGroup
      .transition()
      .duration(1000)
      .attr(
        "transform",
        `translate(0, ${this.barHeight - this.margin.bottom})`,
      );

    // Update y-axis to years
    this.yAxisGroup
      .transition()
      .duration(1000)
      .call(
        d3
          .axisLeft(this.yScale)
          .ticks(d3.timeYear.every(1))
          .tickFormat(d3.timeFormat("%Y")),
      );

    // Hide annotations
    this.annotationsGroup.transition().duration(500).style("opacity", 0);

    // Transition all bars back
    this.chartGroup
      .selectAll(".trade-bar")
      .transition()
      .duration(1000)
      .attr("y", (d) => this.yScale(d.data.date) - 2)
      .attr("height", 4)
      .style("opacity", 1);

    // Make container sticky again
    const stickyContainer = this.container.closest(".sticky-container");
    if (stickyContainer) {
      stickyContainer.style.position = "sticky";
      stickyContainer.style.height = "100vh";
    }
  }

  drawAnnotations() {
    this.annotationsGroup.selectAll("*").remove();

    this.timelineData.forEach((event) => {
      const yPos = this.yScale2025(event.date);
      const xPos = this.width - this.margin.right + 10;

      // Dot on the left side
      this.annotationsGroup
        .append("circle")
        .attr("cx", this.margin.left - 10)
        .attr("cy", yPos)
        .attr("r", 3)
        .attr("fill", "#df3144")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);

      // Connecting line to text
      this.annotationsGroup
        .append("line")
        .attr("x1", this.margin.left - 7)
        .attr("y1", yPos)
        .attr("x2", xPos - 5)
        .attr("y2", yPos)
        .attr("stroke", "#ddd")
        .attr("stroke-width", 0.5);

      // Text on the right
      const text = this.annotationsGroup
        .append("text")
        .attr("x", xPos)
        .attr("y", yPos)
        .attr("dy", "0.35em")
        .style("font-size", "10px")
        .style("fill", "#666")
        .text(event.event);

      // Wrap long text
      this.wrapText(text, this.margin.right - 20);
    });

    this.annotationsGroup
      .transition()
      .duration(1000)
      .delay(500)
      .style("opacity", 1);
  }

  wrapText(text, width) {
    text.each(function () {
      const text = d3.select(this);
      const words = text.text().split(/\s+/).reverse();
      let word;
      let line = [];
      let lineNumber = 0;
      const lineHeight = 1.1; // ems
      const y = text.attr("y");
      const dy = parseFloat(text.attr("dy"));
      let tspan = text
        .text(null)
        .append("tspan")
        .attr("x", text.attr("x"))
        .attr("y", y)
        .attr("dy", dy + "em");

      while ((word = words.pop())) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node().getComputedTextLength() > width) {
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = text
            .append("tspan")
            .attr("x", text.attr("x"))
            .attr("y", y)
            .attr("dy", ++lineNumber * lineHeight + dy + "em")
            .text(word);
        }
      }
    });
  }
}

export default TradeChart;
