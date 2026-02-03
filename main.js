import { DotMapPlot } from "./DotMapPlot.js";
import { PeaceMap } from "./PeaceMap.js";
import { ChoroplethMap } from "./ChoroplethMap.js";
import { TradeChart } from "./TradeChart.js";
import { MapDotPlot } from "./MapDotPlot.js";
import { ForcesAreaChart } from "./ForcesAreaChart.js";
import { FMSCategoryScatter } from "./FMSCategoryScatter.js";
import { FMSRegionChart } from "./FMSRegionChart.js";

document.addEventListener("DOMContentLoaded", () => {
  // Initialize all visualizations
  const dotMapElement = document.getElementById("visualization-dotmap");
  const peaceMapElement = document.getElementById("visualization-peace");
  const choroplethMapElement = document.getElementById(
    "visualization-choropleth",
  );
  const tradeMapElement = document.getElementById("visualization-trade");
  const mapDotElement = document.getElementById("visualization-mapdot");
  const forcesAreaChartElement = document.getElementById(
    "visualization-forces-area",
  );
  const fmsCategoryScatterElement = document.getElementById(
    "visualization-fms-category",
  );
  const fmsRegionChartElement = document.getElementById(
    "visualization-fms-region",
  );

  const dotMapPlot = new DotMapPlot(dotMapElement);
  const peaceMap = new PeaceMap(peaceMapElement);
  const choroplethMap = new ChoroplethMap(choroplethMapElement);
  const tradeChart = new TradeChart(tradeMapElement);
  const mapDotPlot = new MapDotPlot(mapDotElement);
  const forcesAreaChart = new ForcesAreaChart(forcesAreaChartElement);
  const fmsCategoryScatter = new FMSCategoryScatter(fmsCategoryScatterElement);
  const fmsRegionChart = new FMSRegionChart(fmsRegionChartElement);

  // Setup observers for dotmap scrollytelling
  const dotmapCards = document.querySelectorAll('.card[data-viz="dotmap"]');

  const dotmapObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // Only act when card enters viewport and crosses threshold
        if (!entry.isIntersecting) return;

        const step = parseInt(entry.target.dataset.step);

        // Make this card active
        dotmapCards.forEach((card) => card.classList.remove("active"));
        entry.target.classList.add("active");

        console.log("Dotmap active step:", step);

        // Update title
        dotMapPlot.updateTitle(step);

        if (step < 4) {
          // Steps 0-3: Dot plot view with color changes, no scroll animation
          dotMapPlot.stopScrollAnimation();
          dotMapPlot.updateColors(step);

          // Hide labels if coming back from map view
          if (dotMapPlot.labelsVisible) {
            dotMapPlot.hideCountryLabels();
          }

          // Ensure we're in dot plot view (use instant transition if needed)
          if (dotMapPlot.isMapView) {
            dotMapPlot.setTransitionProgress(true, 0);
            dotMapPlot.isMapView = false;
          }
        } else if (step === 4) {
          // Step 4: The transition card - animate from dot plot to map
          dotMapPlot.updateColors(step); // Set colors for map view

          // Hide labels during transition
          if (dotMapPlot.labelsVisible) {
            dotMapPlot.hideCountryLabels();
          }

          dotMapPlot.startScrollAnimation(entry.target, "toMap");
        } else {
          // Steps 5+: Stay in map view, no scroll animation
          dotMapPlot.stopScrollAnimation();
          dotMapPlot.updateColors(step);

          // Ensure we're in map view (use instant transition if needed)
          if (!dotMapPlot.isMapView) {
            dotMapPlot.setTransitionProgress(true, 1);
            dotMapPlot.isMapView = true;
          }

          // Handle labels
          if (step === 5) {
            dotMapPlot.showCountryLabels(step);
          } else if (step >= 6) {
            dotMapPlot.showCountryLabels(step);
          }
        }
      });
    },
    {
      threshold: 0.5,
      rootMargin: "0px",
    },
  );

  // Observe dotmap cards
  dotmapCards.forEach((card) => dotmapObserver.observe(card));

  // Separate observer for step 4 animation cleanup when it leaves
  const dotmapStep4Observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const step = parseInt(entry.target.dataset.step);
        if (
          step === 4 &&
          !entry.isIntersecting &&
          dotMapPlot.currentTransitionCard === entry.target
        ) {
          // Step 4 is leaving - stop the animation
          dotMapPlot.stopScrollAnimation();

          // Snap to final state based on current progress
          const currentProgress = dotMapPlot.calculateScrollProgress(
            entry.target,
          );
          if (currentProgress > 0.5) {
            // Closer to map - complete the transition
            dotMapPlot.setTransitionProgress(true, 1);
            dotMapPlot.isMapView = true;
          } else {
            // Closer to dot plot - revert
            dotMapPlot.setTransitionProgress(true, 0);
            dotMapPlot.isMapView = false;
          }
        }
      });
    },
    {
      threshold: 0,
      rootMargin: "0px",
    },
  );

  // Only observe step 4 for cleanup
  dotmapCards.forEach((card) => {
    if (parseInt(card.dataset.step) === 4) {
      dotmapStep4Observer.observe(card);
    }
  });

  // Setup observers for choropleth scrollytelling
  const choroplethCards = document.querySelectorAll(
    '.card[data-viz="choropleth"]',
  );

  const choroplethObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const step = parseInt(entry.target.dataset.step);

        choroplethCards.forEach((card) => card.classList.remove("active"));
        entry.target.classList.add("active");

        console.log("Choropleth active step:", step);

        // Handle choropleth transitions
        if (step >= 2) {
          choroplethMap.toggleView(true, step);
        } else {
          if (choroplethMap.currentView === "continuous") {
            choroplethMap.toggleView(false, step);
          }
        }
      });
    },
    {
      threshold: 0.5,
      rootMargin: "0px",
    },
  );

  // Observe choropleth cards
  choroplethCards.forEach((card) => choroplethObserver.observe(card));

  const peaceCards = document.querySelectorAll('.card[data-viz="peace"]');

  const peaceObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const step = parseInt(entry.target.dataset.step);

        peaceCards.forEach((card) => card.classList.remove("active"));
        entry.target.classList.add("active");

        console.log("Peace map active step:", step);
        peaceMap.highlightStep(step);
      });
    },
    {
      threshold: 0.5,
      rootMargin: "0px",
    },
  );

  // Observe peace cards
  peaceCards.forEach((card) => peaceObserver.observe(card));

  const tradeCards = document.querySelectorAll('.card[data-viz="trade"]');

  const tradeObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const step = parseInt(entry.target.dataset.step);

        tradeCards.forEach((card) => card.classList.remove("active"));
        entry.target.classList.add("active");

        console.log("Trade chart active step:", step);

        // Highlight specific dates based on step
        tradeChart.highlightDate(step);
      });
    },
    {
      threshold: 0.5,
      rootMargin: "0px",
    },
  );

  // Observe trade cards
  tradeCards.forEach((card) => tradeObserver.observe(card));

  // Setup observers for mapdot scrollytelling with scroll-bound animations
  const mapdotCards = document.querySelectorAll('.card[data-viz="mapdot"]');

  const mapdotObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const step = parseInt(entry.target.dataset.step);

        mapdotCards.forEach((card) => card.classList.remove("active"));
        entry.target.classList.add("active");

        console.log("Mapdot active step:", step);

        if (step < 2) {
          // Steps 0-1: Stay in map view, no scroll animation
          mapDotPlot.stopScrollAnimation();
          // Set to map view instantly (progress = 0 means full map view)
          if (mapDotPlot.isScatterView) {
            mapDotPlot.setTransitionProgress(true, 0);
            mapDotPlot.isScatterView = false;
          }
          mapDotPlot.highlightTypeByStep(null);
        } else if (step === 2) {
          // Step 2: The transition card - animate from map to scatter
          mapDotPlot.startScrollAnimation(entry.target, "toScatter");
        } else {
          // Steps 3+: Stay in scatter view, no scroll animation
          mapDotPlot.stopScrollAnimation();

          if (!mapDotPlot.isScatterView) {
            mapDotPlot.setTransitionProgress(true, 1);
            mapDotPlot.isScatterView = true;
          }

          // 🔥 Highlight groups by step
          mapDotPlot.highlightTypeByStep(step);
        }
      });
    },
    {
      threshold: 0.5,
      rootMargin: "0px",
    },
  );

  // Observe mapdot cards
  mapdotCards.forEach((card) => mapdotObserver.observe(card));

  // Separate observer for step 2 animation cleanup when it leaves
  const mapdotStep2Observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const step = parseInt(entry.target.dataset.step);
        if (
          step === 2 &&
          !entry.isIntersecting &&
          mapDotPlot.currentTransitionCard === entry.target
        ) {
          // Step 2 is leaving - stop the animation
          mapDotPlot.stopScrollAnimation();

          // Snap to final state based on current progress
          const currentProgress = mapDotPlot.calculateScrollProgress(
            entry.target,
          );
          if (currentProgress > 0.5) {
            // Closer to scatter - complete the transition
            mapDotPlot.setTransitionProgress(true, 1);
            mapDotPlot.isScatterView = true;
          } else {
            // Closer to map - revert
            mapDotPlot.setTransitionProgress(true, 0);
            mapDotPlot.isScatterView = false;
          }
        }
      });
    },
    {
      threshold: 0,
      rootMargin: "0px",
    },
  );

  // Only observe step 2 for cleanup
  mapdotCards.forEach((card) => {
    if (parseInt(card.dataset.step) === 2) {
      mapdotStep2Observer.observe(card);
    }
  });

  // Setup observers for forces area scrollytelling
  const forcesCards = document.querySelectorAll(
    '.card[data-viz="forces-area"]',
  );

  const forcesObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const step = parseInt(entry.target.dataset.step);
        forcesCards.forEach((c) => c.classList.remove("active"));
        entry.target.classList.add("active");

        console.log("Forces area active step:", step);
        // hook for future step-based behavior if needed
      });
    },
    { threshold: 0.5 },
  );

  forcesCards.forEach((card) => forcesObserver.observe(card));

  // Setup observers for FMS category scrollytelling
  const fmsCategoryCards = document.querySelectorAll(
    '.card[data-viz="fms-category"]',
  );

  const fmsCategoryObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const step = parseInt(entry.target.dataset.step);
        fmsCategoryCards.forEach((c) => c.classList.remove("active"));
        entry.target.classList.add("active");

        console.log("FMS category active step:", step);
      });
    },
    { threshold: 0.5 },
  );

  fmsCategoryCards.forEach((card) => fmsCategoryObserver.observe(card));

  // Setup observers for FMS region scrollytelling
  const fmsRegionCards = document.querySelectorAll(
    '.card[data-viz="fms-region"]',
  );

  const fmsRegionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const step = parseInt(entry.target.dataset.step);
        fmsRegionCards.forEach((c) => c.classList.remove("active"));
        entry.target.classList.add("active");

        console.log("FMS region active step:", step);
        fmsRegionChart.highlightRegion(step);
      });
    },
    { threshold: 0.5 },
  );

  fmsRegionCards.forEach((card) => fmsRegionObserver.observe(card));
});
