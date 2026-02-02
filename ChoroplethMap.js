import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";

export class ChoroplethMap {
  constructor(container) {
    this.container = container;

    // Get container dimensions
    const containerRect = container.getBoundingClientRect();
    this.width = containerRect.width;

    // Legend margin at top
    this.legendMargin = 30;

    // Map height (Robinson aspect ratio) + margin for legend
    this.mapHeight = containerRect.width * 0.6;
    this.height = this.mapHeight + this.legendMargin;

    this.currentView = "categorical"; // Track current fill type

    this.init();

    window.addEventListener("resize", () => {
      const containerRect = container.getBoundingClientRect();
      this.width = containerRect.width;
      this.mapHeight = containerRect.width * 0.6;
      this.height = this.mapHeight + this.legendMargin;
      this.resize();
    });
  }

  async init() {
    await this.loadData();
    this.setupProjection();
    this.setupColorScales();
    this.createSVG();
    this.setupElements();
  }

  async loadData() {
    try {
      const [ieepaSf, worldData] = await Promise.all([
        d3.json(
          "https://euissr.github.io/commentary_2026_02-GS-Trump-II/ieepa_sf.geojson",
        ),
        d3.json("https://unpkg.com/world-atlas@2/land-110m.json"),
      ]);

      this.ieepaSf = ieepaSf;
      this.worldData = worldData;

      console.log("IEEPA data loaded:", {
        ieepaSfFeatures: ieepaSf.features.length,
      });
    } catch (error) {
      console.error("Error loading data:", error);
      throw error;
    }
  }

  setupProjection() {
    this.projection = d3
      .geoEqualEarth()
      .scale(150) // Add a fixed scale
      .translate([this.width / 2, this.mapHeight / 2 + this.legendMargin]);

    this.path = d3.geoPath().projection(this.projection);
  }

  setupColorScales() {
    // Categorical color scale for "cat"
    this.categoricalScale = d3
      .scaleOrdinal()
      .domain([
        "Reciprocal",
        "Exempt",
        'Reciprocal and Limitations on "free speech"',
        "Fentanyl crisis",
        "Reciprocal and Secondary tariffs for Russian oil",
      ])
      .range(["#309ebe", "#C6C6C6", "#376882", "#df3144", "#1d3956"]);

    // Continuous color scale for "rate"
    const rateExtent = d3.extent(
      this.ieepaSf.features,
      (d) => d.properties.rate,
    );
    this.continuousScale = d3
      .scaleSequential()
      .domain(rateExtent)
      .interpolator(
        d3.interpolateRgbBasis([
          "#fff",
          "#FFDE75",
          "#64C2C7",
          "#376882",
          "#33163A",
        ]),
      );
  }

  createSVG() {
    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("width", this.width)
      .attr("height", this.height);
  }

  setupElements() {
    // Add background land (no fill, gray stroke)
    this.land = this.svg
      .append("path")
      .datum(topojson.feature(this.worldData, this.worldData.objects.land))
      .attr("class", "land")
      .attr("d", this.path)
      .attr("fill", "none")
      .attr("stroke", "#c6c6c6")
      .attr("stroke-width", 0.5);

    // Add IEEPA countries (choropleth)
    this.countries = this.svg
      .append("g")
      .attr("class", "ieepa-countries")
      .selectAll(".ieepa-country")
      .data(this.ieepaSf.features)
      .enter()
      .append("path")
      .attr("class", "ieepa-country")
      .attr("d", this.path)
      .attr("fill", (d) => this.categoricalScale(d.properties.cat))
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .on("mouseover", (event, d) => this.showTooltip(event, d))
      .on("mouseout", () => this.hideTooltip());

    // Setup legends
    this.setupLegends();

    // Setup tooltip
    this.setupTooltip();

    // Add title
    this.titleText = this.svg
      .append("text")
      .attr("class", "viz-title")
      .attr("x", this.width)
      .attr("y", 20) // Distance from top of SVG
      .text("Countries targeted by Trump tariffs");
  }

  setupLegends() {
    const legendX = 5;
    const legendY = 15; // Position in top margin

    // Categorical Legend (horizontal)
    this.categoricalLegend = this.svg
      .append("g")
      .attr("class", "categorical-legend")
      .attr("transform", `translate(${legendX}, ${legendY})`)
      .style("opacity", 1);

    // Legend title
    this.categoricalLegend
      .append("text")
      .attr("x", 0)
      .attr("y", -5)
      .style("font-size", "14px")
      .style("font-weight", "700")
      .style("fill", "#333")
      .style("stroke", "#fff")
      .style("stroke-width", "3")
      .style("paint-order", "stroke")
      .text("Tariff category");

    const categoricalItems = [
      { label: "Reciprocal", color: "#309ebe", short: true },
      { label: "Exempt", color: "#C6C6C6", short: true },
      { label: "Fentanyl crisis", color: "#df3144", short: true },
      {
        label: "Reciprocal and limitations on 'free speech'",
        color: "#376882",
        short: false,
      },
      {
        label: "Reciprocal and secondary tariffs for Russian oil",
        color: "#1d3956",
        short: false,
      },
    ];

    // First row: short labels
    let xOffset = 0;
    categoricalItems
      .filter((item) => item.short)
      .forEach((item, i) => {
        const group = this.categoricalLegend
          .append("g")
          .attr("transform", `translate(${xOffset}, 0)`);

        (group
          .append("circle")
          .attr("cx", 6)
          .attr("cy", 8)
          .attr("r", 6)
          .attr("fill", item.color)
          .attr("stroke", "#fff")
          .attr("stroke-width", 0.5),
          group
            .append("text")
            .attr("x", 16)
            .attr("y", 12)
            .style("font-size", "11px")
            .style("fill", "#333")
            .text(item.label));

        xOffset += this.width / 9 < 100 ? this.width / 9 : 100;
      });

    // Second row: long labels
    xOffset = 0;
    categoricalItems
      .filter((item) => !item.short)
      .forEach((item, i) => {
        const group = this.categoricalLegend
          .append("g")
          .attr("transform", `translate(${xOffset}, 20)`);

        group
          .append("circle")
          .attr("cx", 6)
          .attr("cy", 8)
          .attr("r", 6)
          .attr("fill", item.color)
          .attr("stroke", "#fff")
          .attr("stroke-width", 0.5);

        group
          .append("text")
          .attr("x", 16)
          .attr("y", 12)
          .style("font-size", "11px")
          .style("fill", "#333")
          .text(item.label);

        xOffset += this.width / 9 < 100 ? this.width / 3.5 : 250;
      });

    // Continuous Legend (horizontal gradient)
    this.continuousLegend = this.svg
      .append("g")
      .attr("class", "continuous-legend")
      .attr("transform", `translate(${legendX}, ${legendY})`)
      .style("opacity", 0);

    // Legend title
    this.continuousLegend
      .append("text")
      .attr("x", 0)
      .attr("y", -5)
      .style("font-size", "14px")
      .style("font-weight", "700")
      .style("fill", "#333")
      .text("Tariff rate (%)");

    // Gradient definition (horizontal)
    const defs = this.svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "rate-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");

    // Add color stops (reversed for horizontal left-to-right)
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#fff");
    gradient.append("stop").attr("offset", "25%").attr("stop-color", "#FFDE75");
    gradient.append("stop").attr("offset", "50%").attr("stop-color", "#64C2C7");
    gradient.append("stop").attr("offset", "75%").attr("stop-color", "#376882");
    gradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#33163A");

    // Draw gradient rectangle (horizontal)
    const gradientWidth = this.width / 3;
    this.continuousLegend
      .append("rect")
      .attr("width", gradientWidth)
      .attr("height", 10)
      .attr("y", 0)
      .style("fill", "url(#rate-gradient)")
      .attr("stroke", "#999")
      .attr("stroke-width", 0.5)
      .attr("rx", 5);

    // Add labels
    const rateExtent = d3.extent(
      this.ieepaSf.features,
      (d) => d.properties.rate,
    );

    // Low value (left)
    this.continuousLegend
      .append("text")
      .attr("x", 0)
      .attr("y", 20)
      .style("font-size", "11px")
      .style("fill", "#333")
      .text(`${Math.round(rateExtent[0])}%`);

    // Mid value
    this.continuousLegend
      .append("text")
      .attr("x", gradientWidth / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .style("fill", "#333")
      .text(`${Math.round((rateExtent[0] + rateExtent[1]) / 2)}%`);

    // High value (right)
    this.continuousLegend
      .append("text")
      .attr("x", gradientWidth)
      .attr("y", 20)
      .attr("text-anchor", "end")
      .style("font-size", "11px")
      .style("fill", "#333")
      .text(`${Math.round(rateExtent[1])}%`);
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
    let html = `<strong>${props.country}</strong><br/>`;
    html += `Category: ${props.cat}<br/>`;
    html += `Rate: ${props.rate}%<br/>`;
    if (props.note) {
      html += `<br/><em>${props.note}</em>`;
    }

    this.tooltip
      .style("opacity", 1)
      .html(html)
      .style("left", event.pageX + 10 + "px")
      .style("top", event.pageY - 10 + "px");
  }

  hideTooltip() {
    this.tooltip.style("opacity", 0);
  }

  resize() {
    // Update SVG size
    this.svg.attr("width", this.width).attr("height", this.height);

    // Update projection
    this.projection
      .scale(this.width / 6) // Adjust this ratio as needed
      .translate([this.width / 2, this.mapHeight / 2 + this.legendMargin]);

    // Update all paths
    this.land.attr("d", this.path);
    this.countries.attr("d", this.path);
  }

  toggleView(isContinuous, step) {
    if (isContinuous) {
      // Switch to continuous (rate) view
      this.currentView = "continuous";

      this.countries
        .transition()
        .duration(1000)
        .attr("fill", (d) => this.continuousScale(d.properties.rate));

      // Switch legends
      this.categoricalLegend.transition().duration(500).style("opacity", 0);
      this.continuousLegend
        .transition()
        .duration(500)
        .delay(500)
        .style("opacity", 1);
    } else {
      // Switch to categorical (cat) view
      this.currentView = "categorical";

      this.countries
        .transition()
        .duration(1000)
        .attr("fill", (d) => this.categoricalScale(d.properties.cat));

      // Switch legends
      this.continuousLegend.transition().duration(500).style("opacity", 0);
      this.categoricalLegend
        .transition()
        .duration(500)
        .delay(500)
        .style("opacity", 1);
    }
  }
}

export default ChoroplethMap;
