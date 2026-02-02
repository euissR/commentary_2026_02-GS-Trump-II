import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";

export class DotMapPlot {
  constructor(container) {
    this.container = container;

    // Get container dimensions, constrained to viewport
    const containerRect = container.getBoundingClientRect();
    this.width = Math.min(containerRect.width, window.innerWidth * 0.95);
    this.height = Math.min(this.width, window.innerHeight * 0.95);

    // Dot plot dimensions (for the stacked week view)
    this.dotWidth = this.width * 0.9;
    this.dotHeight = this.width * 0.6;
    this.dotOffsetX = (this.width - this.dotWidth) / 2;
    this.dotOffsetY = (this.height - this.dotHeight) / 2;

    this.isMapView = false;
    this.labelsVisible = false;

    // Scroll-bound animation state
    this.scrollAnimationActive = false;
    this.currentTransitionCard = null;
    this.transitionDirection = null; // 'toMap' or 'toDotPlot'
    this.rafId = null;

    this.init();

    window.addEventListener("resize", () => {
      const containerRect = container.getBoundingClientRect();
      this.width = Math.min(containerRect.width, window.innerWidth * 0.95);
      this.height = Math.min(this.width, window.innerHeight * 0.95);
      this.dotWidth = this.width * 0.9;
      this.dotHeight = this.width * 0.6;
      this.dotOffsetX = (this.width - this.dotWidth) / 2;
      this.dotOffsetY = (this.height - this.dotHeight) / 2;
      this.resize();
    });
  }

  async init() {
    await this.loadData();
    this.setupProjection();
    this.setupScales();
    this.createSVG();
    this.setupElements();
  }

  async loadData() {
    try {
      // Load strikes data
      const [csvData, geoData, geoAggregate, strikeCountries, worldData] =
        await Promise.all([
          d3.csv("./strikes_week_stack.csv", (d) => ({
            id: +d.id,
            event_date: new Date(d.event_date),
            year: +d.year,
            President: d.President,
            country: d.country,
            latitude: +d.latitude,
            longitude: +d.longitude,
            week: d.week,
            stack: +d.stack,
          })),
          d3.json("./strikes_week_stack_sf.geojson"),
          d3.json("./strikes_country.geojson"),
          d3.json("./strikes_countries.geojson"),
          d3.json("https://unpkg.com/world-atlas@2/land-110m.json"),
        ]);

      this.csvData = csvData;
      this.geoData = geoData;
      this.geoAggregate = geoAggregate;
      this.strikeCountries = strikeCountries;
      this.worldData = worldData;

      // Get unique weeks for the dot plot x-axis
      this.weeks = [...new Set(csvData.map((d) => d.week))].sort();

      // Get max stack for y-axis
      this.maxStack = d3.max(csvData, (d) => d.stack);

      console.log("Data loaded:", {
        csvRows: csvData.length,
        geoFeatures: geoData.features.length,
        geoAggregate: geoAggregate.features.length,
        strikeCountries: strikeCountries.features.length,
        weeks: this.weeks.length,
        maxStack: this.maxStack,
      });
    } catch (error) {
      console.error("Error loading data:", error);
      throw error;
    }
  }

  setupProjection() {
    this.projection = d3
      .geoAzimuthalEqualArea()
      .scale(this.width / 2.75)
      .center([0, 0])
      .rotate([20, 0])
      .translate([this.width / 2, this.height / 2]);

    this.path = d3.geoPath().projection(this.projection);
  }

  setupScales() {
    // Dot plot scales
    this.xScale = d3
      .scaleTime()
      .domain(d3.extent(this.csvData, (d) => d.event_date))
      .range([this.dotOffsetX, this.dotOffsetX + this.dotWidth]);

    this.yScale = d3
      .scaleLinear()
      .domain([0, this.maxStack + 1])
      .range([this.dotOffsetY + this.dotHeight, this.dotOffsetY]);

    // Color scale by President
    const countries = [...new Set(this.csvData.map((d) => d.President))];
    this.colorScale = d3
      .scaleOrdinal()
      .domain(countries)
      .range(["#df3144", "#1d3956", "#df3144"]);
  }

  createSVG() {
    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("width", this.width)
      .attr("height", this.height);
  }

  setupElements() {
    // Setup axes (initially visible for dot plot)
    this.setupAxes();

    // Setup world map (initially hidden)
    this.setupMap();

    // Setup data points
    this.setupDataPoints();

    // Setup tooltip
    this.setupTooltip();

    // add aggregate labels
    this.setupCountryLabels();
  }

  setupAxes() {
    this.axesGroup = this.svg.append("g").style("opacity", 1);

    // Y-axis (stack count)
    const yAxis = d3.axisLeft(this.yScale).ticks(5);
  }

  setupMap() {
    this.mapGroup = this.svg.append("g").style("opacity", 0);

    // Add land
    this.land = this.mapGroup
      .append("path")
      .datum(topojson.feature(this.worldData, this.worldData.objects.land))
      .attr("class", "land")
      .attr("d", this.path)
      .attr("fill", "#fff")
      .attr("stroke", "#c6c6c6")
      .attr("stroke-width", 0.5);

    // Add strike countries (concerned country outlines) - ADD THIS:
    this.strikeCountriesGroup = this.mapGroup
      .append("g")
      .attr("class", "strike-countries");

    // actually draw the paths:
    this.strikeCountriesGroup
      .selectAll(".strike-country")
      .data(this.strikeCountries.features)
      .enter()
      .append("path")
      .attr("class", "strike-country")
      .attr("d", this.path)
      .attr("fill", "none")
      .attr("stroke", "#000")
      .attr("stroke-width", 0.5);
  }

  setupDataPoints() {
    // Create dots from CSV data (for initial dot plot view)
    this.dots = this.svg
      .selectAll(".strike-dot")
      .data(this.csvData)
      .enter()
      .append("circle")
      .attr("class", "strike-dot")
      .attr("r", 2.5)
      .attr("cx", (d) => this.xScale(d.event_date))
      .attr("cy", (d) => this.yScale(d.stack))
      .attr("fill", "#c6c6c6") // Start with all dots gray
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.25)
      .style("opacity", 1)
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
    const date = new Date(d.event_date);
    const formattedDate = d3.timeFormat("%B %d, %Y")(date);

    this.tooltip
      .style("opacity", 1)
      .html(
        `
        <strong>${d.country}</strong><br/>
        Date: ${formattedDate}<br/>
        President: ${d.President}
      `,
      )
      .style("left", event.pageX + 10 + "px")
      .style("top", event.pageY - 10 + "px");
  }

  hideTooltip() {
    this.tooltip.style("opacity", 0);
  }

  setupCountryLabels() {
    this.countryLabels = this.svg
      .append("g")
      .attr("class", "country-labels")
      .style("opacity", 0);
  }

  updateColors(step) {
    this.dots
      .transition()
      .duration(1000)
      .attr("fill", (d) => {
        if (step === 0) {
          // Step 0: All gray
          return "#c6c6c6";
        } else if (step === 1) {
          // Step 1: Biden blue, others gray
          return d.President === "Biden" ? "#1d3956" : "#c6c6c6";
        } else if (step === 2) {
          // Step 2: Trump I red, others gray
          return d.President === "Trump I" ? "#df3144" : "#c6c6c6";
        } else if (step === 3) {
          // Step 3: Trump II red, others gray
          return d.President === "Trump II" ? "#df3144" : "#c6c6c6";
        } else if (step === 4 || step === 5) {
          // Steps 4-5: All dots colored by president (for map view)
          return this.colorScale(d.President);
        } else if (step >= 6) {
          // Step 6+: Yemen/Somalia only
          if (d.country === "Yemen" || d.country === "Somalia") {
            return this.colorScale(d.President);
          } else {
            return "#c6c6c6";
          }
        }
      });
  }

  updateStep(step) {
    // Update title
    this.updateTitle(step);

    // Update colors first
    this.updateColors(step);

    // Handle view transitions
    if (step >= 4) {
      // Steps 4+: Map view
      if (!this.isMapView) {
        this.toggleView(true, step);
      } else {
        // Already in map view, just update labels if needed
        if (step === 5) {
          this.showCountryLabels(step);
        } else if (step >= 6) {
          // Redraw labels with filter for Yemen/Somalia
          this.showCountryLabels(step);
        } else if (step < 5 && this.labelsVisible) {
          this.hideCountryLabels();
        }
      }
    } else {
      // Steps 0-3: Dot plot view
      if (this.isMapView) {
        this.toggleView(false, step);
      }
    }
  }

  updateTitle(step) {
    const titleElement =
      this.container.parentElement.querySelector(".sticky-title");
    if (!titleElement) return;

    if (step >= 4) {
      // Map view title
      titleElement.textContent = "US strikes in 2025";
    } else {
      // Dot plot view title
      titleElement.textContent = "Timeline of US strikes worldwide, 2017-25";
    }
  }

  showCountryLabels(step) {
    this.countryLabels.selectAll("*").remove();

    // Filter data based on step
    let labelData = this.geoAggregate.features;
    if (step >= 6) {
      // Only show Yemen and Somalia labels
      labelData = this.geoAggregate.features.filter(
        (d) =>
          d.properties.country === "Yemen" ||
          d.properties.country === "Somalia",
      );
    }

    this.countryLabels
      .selectAll(".country-label")
      .data(labelData)
      .enter()
      .append("text")
      .attr("class", "country-label")
      .attr("x", (d) => {
        const baseX = this.projection(d.geometry.coordinates)[0];
        if (d.properties.country === "Somalia") return baseX - 40;
        if (d.properties.country === "Venezuela") return baseX + 40;
        if (d.properties.country === "Caribbean") return baseX + 40;
        return baseX;
      })
      .attr("y", (d) => {
        const baseY = this.projection(d.geometry.coordinates)[1];
        if (d.properties.country === "Somalia") return baseY;
        if (d.properties.country === "Venezuela") return baseY;
        if (d.properties.country === "Caribbean") return baseY - 20;
        return baseY - 30;
      })
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("opacity", 0)
      .each(function (d) {
        const text = d3.select(this);
        text
          .append("tspan")
          .attr("x", text.attr("x"))
          .attr("dy", "0")
          .style("font-weight", "700")
          .style("fill", "#333")
          .style("stroke", "#fff")
          .style("stroke-width", "3")
          .style("paint-order", "stroke")
          .text(d.properties.country);

        text
          .append("tspan")
          .attr("x", text.attr("x"))
          .attr("dy", "1.2em")
          .style("font-weight", "400")
          .style("fill", "#666")
          .style("stroke", "#fff")
          .style("stroke-width", "3")
          .style("paint-order", "stroke")
          .text(`${d.properties.n} strikes`);
      })
      .transition()
      .delay(500)
      .duration(500)
      .style("opacity", 1);

    this.countryLabels
      .transition()
      .duration(500)
      .delay(500)
      .style("opacity", 1);

    this.labelsVisible = true;
  }

  hideCountryLabels() {
    this.countryLabels.transition().duration(500).style("opacity", 0);
    this.labelsVisible = false;
  }

  // Scroll-based transition with progress value (0-1)
  setTransitionProgress(toMap, progress) {
    // Clamp progress between 0 and 1
    progress = Math.max(0, Math.min(1, progress));

    if (toMap) {
      // Interpolate from dot plot to map view
      this.dots
        .attr("cx", (d) => {
          const startX = this.xScale(d.event_date);
          const geoFeature = this.geoData.features.find(
            (f) => f.properties.id === d.id,
          );
          if (geoFeature) {
            const endX = this.projection(geoFeature.geometry.coordinates)[0];
            return d3.interpolate(startX, endX)(progress);
          }
          return startX;
        })
        .attr("cy", (d) => {
          const startY = this.yScale(d.stack);
          const geoFeature = this.geoData.features.find(
            (f) => f.properties.id === d.id,
          );
          if (geoFeature) {
            const endY = this.projection(geoFeature.geometry.coordinates)[1];
            return d3.interpolate(startY, endY)(progress);
          }
          return startY;
        })
        .attr("r", 2.5)
        .attr("stroke-width", 0)
        .style("opacity", (d) => {
          const geoFeature = this.geoData.features.find(
            (f) => f.properties.id === d.id,
          );
          if (geoFeature) {
            return d3.interpolate(1, 0.33)(progress);
          }
          return d3.interpolate(1, 0)(progress);
        });

      // Fade out axes, fade in map
      this.axesGroup.style("opacity", 1 - progress);
      this.mapGroup.style("opacity", progress);
    } else {
      // Interpolate from map to dot plot view
      this.dots
        .attr("cx", (d) => {
          const geoFeature = this.geoData.features.find(
            (f) => f.properties.id === d.id,
          );
          const endX = this.xScale(d.event_date);
          if (geoFeature) {
            const startX = this.projection(geoFeature.geometry.coordinates)[0];
            return d3.interpolate(startX, endX)(progress);
          }
          return endX;
        })
        .attr("cy", (d) => {
          const geoFeature = this.geoData.features.find(
            (f) => f.properties.id === d.id,
          );
          const endY = this.yScale(d.stack);
          if (geoFeature) {
            const startY = this.projection(geoFeature.geometry.coordinates)[1];
            return d3.interpolate(startY, endY)(progress);
          }
          return endY;
        })
        .attr("r", 2.5)
        .style("opacity", (d) => {
          const geoFeature = this.geoData.features.find(
            (f) => f.properties.id === d.id,
          );
          if (geoFeature) {
            return d3.interpolate(0.33, 1)(progress);
          }
          return d3.interpolate(0, 1)(progress);
        });

      // Fade in axes, fade out map
      this.axesGroup.style("opacity", progress);
      this.mapGroup.style("opacity", 1 - progress);
    }
  }

  // Calculate scroll progress for a card (0 = entering viewport, 1 = leaving viewport)
  calculateScrollProgress(card) {
    const rect = card.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    const cardTop = rect.top;

    // Start transition when card is 80vh from top, complete when it reaches 20vh from top
    const startY = viewportHeight * 0.8;
    const endY = viewportHeight * 0.2;

    let progress = (startY - cardTop) / (startY - endY);

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, progress));
  }

  // Update animation based on current scroll position
  updateScrollAnimation() {
    if (!this.scrollAnimationActive || !this.currentTransitionCard) {
      return;
    }

    const progress = this.calculateScrollProgress(this.currentTransitionCard);

    if (this.transitionDirection === "toMap") {
      this.setTransitionProgress(true, progress);
    } else if (this.transitionDirection === "toDotPlot") {
      this.setTransitionProgress(false, progress);
    }

    // Continue animating
    this.rafId = requestAnimationFrame(() => this.updateScrollAnimation());
  }

  // Start scroll-bound animation
  startScrollAnimation(card, direction) {
    // Stop any existing animation
    this.stopScrollAnimation();

    this.scrollAnimationActive = true;
    this.currentTransitionCard = card;
    this.transitionDirection = direction; // 'toMap' or 'toDotPlot'

    // Start animation loop
    this.updateScrollAnimation();
  }

  // Stop scroll-bound animation
  stopScrollAnimation() {
    this.scrollAnimationActive = false;
    this.currentTransitionCard = null;
    this.transitionDirection = null;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  resize() {
    // Update SVG size
    this.svg.attr("width", this.width).attr("height", this.height);

    // Update projection
    this.projection
      .scale(this.width / 2.5)
      .translate([this.width / 2, this.height / 2]);

    // Update scales
    this.xScale.range([this.dotOffsetX, this.dotOffsetX + this.dotWidth]);
    this.yScale.range([this.dotOffsetY + this.dotHeight, this.dotOffsetY]);

    // Update axes
    this.svg
      .select(".x-axis")
      .attr("transform", `translate(0,${this.dotOffsetY + this.dotHeight})`)
      .call(d3.axisBottom(this.xScale));

    this.svg
      .select(".y-axis")
      .attr("transform", `translate(${this.dotOffsetX},0)`)
      .call(d3.axisLeft(this.yScale));

    // Update map
    this.sphere.attr("d", this.path);
    this.land.attr("d", this.path);
    this.strikeCountriesGroup.selectAll(".strike-country").attr("d", this.path); // ADD THIS

    // Update dot positions based on current view
    if (this.isMapView) {
      this.dots.each((d, i, nodes) => {
        const geoFeature = this.geoData.features.find(
          (f) => f.properties.id === d.id,
        );
        if (geoFeature) {
          const [x, y] = this.projection(geoFeature.geometry.coordinates);
          d3.select(nodes[i]).attr("cx", x).attr("cy", y);
        }
      });
    } else {
      this.dots
        .attr("cx", (d) => this.xScale(d.event_date))
        .attr("cy", (d) => this.yScale(d.stack));
    }
  }

  toggleView(isMap, step) {
    this.isMapView = isMap;

    if (isMap) {
      // Transition to map view
      this.dots
        .transition()
        .duration(1000)
        .attr("cx", (d) => {
          const geoFeature = this.geoData.features.find(
            (f) => f.properties.id === d.id,
          );
          if (geoFeature) {
            const [x] = this.projection(geoFeature.geometry.coordinates);
            return x;
          }
          return this.xScale(d.week);
        })
        .attr("cy", (d) => {
          const geoFeature = this.geoData.features.find(
            (f) => f.properties.id === d.id,
          );
          if (geoFeature) {
            const [, y] = this.projection(geoFeature.geometry.coordinates);
            return y;
          }
          return this.yScale(d.stack);
        })
        .attr("r", 2.5)
        .attr("stroke-width", 0)
        .style("opacity", (d) => {
          const geoFeature = this.geoData.features.find(
            (f) => f.properties.id === d.id,
          );
          return geoFeature ? 0.33 : 0;
        });

      // Fade out axes, fade in map
      this.axesGroup.transition().duration(1000).style("opacity", 0);
      this.mapGroup.transition().duration(1000).style("opacity", 1);

      // Handle country labels based on step
      if (step === 5) {
        this.showCountryLabels(step);
      } else if (step > 5) {
        // Redraw labels with filter
        this.showCountryLabels(step);
      } else {
        // Hide labels for steps < 5
        this.hideCountryLabels();
      }
    } else {
      // Transition back to dot plot view
      this.dots
        .transition()
        .duration(1000)
        .attr("cx", (d) => this.xScale(d.event_date))
        .attr("cy", (d) => this.yScale(d.stack))
        .attr("r", 2.5)
        .style("opacity", 1);

      // Hide country labels
      this.hideCountryLabels();

      // Fade in axes, fade out map
      this.axesGroup.transition().duration(1000).style("opacity", 1);
      this.mapGroup.transition().duration(1000).style("opacity", 0);
    }
  }

  // Optional: Add rotation capability for the map
  startRotation() {
    if (!this.isMapView) return;

    this.rotationTimer = d3.timer((elapsed) => {
      const rotation = [elapsed / 100, -20];
      this.projection.rotate(rotation);

      // Update map
      this.sphere.attr("d", this.path);
      this.land.attr("d", this.path);

      // Update dot positions
      this.dots.each((d, i, nodes) => {
        const geoFeature = this.geoData.features.find(
          (f) => f.properties.id === d.id,
        );
        if (geoFeature) {
          const [x, y] = this.projection(geoFeature.geometry.coordinates);
          const visible = x && y && !isNaN(x) && !isNaN(y);
          d3.select(nodes[i])
            .attr("cx", x)
            .attr("cy", y)
            .style("opacity", visible ? 0.8 : 0);
        }
      });
    });
  }

  stopRotation() {
    if (this.rotationTimer) {
      this.rotationTimer.stop();
    }
  }
}

export default DotMapPlot;
