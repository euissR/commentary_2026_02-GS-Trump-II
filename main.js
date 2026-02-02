import { DotMapPlot } from "./DotMapPlot.js";
import { PeaceMap } from "./PeaceMap.js";
import { ChoroplethMap } from "./ChoroplethMap.js";
import { TradeChart } from "./TradeChart.js";
import { MapDotPlot } from "./MapDotPlot.js";

document.addEventListener("DOMContentLoaded", () => {
  // Initialize all visualizations
  const dotMapElement = document.getElementById("visualization-dotmap");
  const peaceMapElement = document.getElementById("visualization-peace");
  const choroplethMapElement = document.getElementById(
    "visualization-choropleth",
  );
  const tradeMapElement = document.getElementById("visualization-trade");
  const mapDotElement = document.getElementById("visualization-mapdot");

  const dotMapPlot = new DotMapPlot(dotMapElement);
  const peaceMap = new PeaceMap(peaceMapElement);
  const choroplethMap = new ChoroplethMap(choroplethMapElement);
  const tradeChart = new TradeChart(tradeMapElement);
  const mapDotPlot = new MapDotPlot(mapDotElement);

  // Setup observers for dotmap scrollytelling
  const dotmapCards = document.querySelectorAll('.card[data-viz="dotmap"]');

  // Track current active step to prevent flickering
  let currentDotmapStep = 0;

  const dotmapObserver = new IntersectionObserver(
    (entries) => {
      // Find the most visible intersecting card
      let mostVisible = null;
      let maxRatio = 0;

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          mostVisible = entry.target;
          maxRatio = entry.intersectionRatio;
        }
      });

      // Only update if we found a visible card AND it's significantly more visible (hysteresis)
      // This prevents constant switching between adjacent cards
      if (mostVisible) {
        const newStep = parseInt(mostVisible.dataset.step);

        // Only switch steps if:
        // 1. It's a different step, AND
        // 2. The new card is at least 30% visible (prevents premature switching)
        if (newStep !== currentDotmapStep && maxRatio > 0.3) {
          currentDotmapStep = newStep;

          dotmapCards.forEach((card) => card.classList.remove("active"));
          mostVisible.classList.add("active");

          console.log("Dotmap active step:", newStep);

          // Update title
          dotMapPlot.updateTitle(newStep);

          if (newStep < 4) {
            // Steps 0-3: Dot plot view with color changes, no scroll animation
            dotMapPlot.stopScrollAnimation();
            dotMapPlot.updateColors(newStep);

            // Hide labels if coming back from map view
            if (dotMapPlot.labelsVisible) {
              dotMapPlot.hideCountryLabels();
            }

            // Ensure we're in dot plot view (use instant transition if needed)
            if (dotMapPlot.isMapView) {
              dotMapPlot.setTransitionProgress(true, 0);
              dotMapPlot.isMapView = false;
            }
          } else if (newStep === 4) {
            // Step 4: The transition card - animate from dot plot to map
            dotMapPlot.updateColors(newStep); // Set colors for map view

            // Hide labels during transition
            if (dotMapPlot.labelsVisible) {
              dotMapPlot.hideCountryLabels();
            }

            dotMapPlot.startScrollAnimation(mostVisible, "toMap");
          } else {
            // Steps 5+: Stay in map view, no scroll animation
            dotMapPlot.stopScrollAnimation();
            dotMapPlot.updateColors(newStep);

            // Ensure we're in map view (use instant transition if needed)
            if (!dotMapPlot.isMapView) {
              dotMapPlot.setTransitionProgress(true, 1);
              dotMapPlot.isMapView = true;
            }

            // Handle labels
            if (newStep === 5) {
              dotMapPlot.showCountryLabels(newStep);
            } else if (newStep >= 6) {
              dotMapPlot.showCountryLabels(newStep);
            }
          }
        }
      }

      // Handle cards leaving viewport (for step 4 animation cleanup)
      entries.forEach((entry) => {
        const step = parseInt(entry.target.dataset.step);
        if (
          !entry.isIntersecting &&
          step === 4 &&
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
      threshold: [0, 0.25, 0.5, 0.75, 1],
      rootMargin: "0px",
    },
  );

  // Observe dotmap cards
  dotmapCards.forEach((card) => dotmapObserver.observe(card));

  // Setup observers for choropleth scrollytelling
  const choroplethCards = document.querySelectorAll(
    '.card[data-viz="choropleth"]',
  );

  // Track current active step to prevent flickering
  let currentChoroplethStep = 0;

  const choroplethObserver = new IntersectionObserver(
    (entries) => {
      // Find the most visible intersecting card
      let mostVisible = null;
      let maxRatio = 0;

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          mostVisible = entry.target;
          maxRatio = entry.intersectionRatio;
        }
      });

      // Only update if we found a visible card AND it's significantly more visible
      if (mostVisible) {
        const newStep = parseInt(mostVisible.dataset.step);

        // Only switch steps if it's different AND new card is at least 30% visible
        if (newStep !== currentChoroplethStep && maxRatio > 0.3) {
          currentChoroplethStep = newStep;

          choroplethCards.forEach((card) => card.classList.remove("active"));
          mostVisible.classList.add("active");

          console.log("Choropleth active step:", newStep);

          // Handle choropleth transitions
          if (newStep >= 2) {
            choroplethMap.toggleView(true, newStep);
          } else {
            if (choroplethMap.currentView === "continuous") {
              choroplethMap.toggleView(false, newStep);
            }
          }
        }
      }
    },
    {
      threshold: [0, 0.25, 0.5, 0.75, 1],
      rootMargin: "0px",
    },
  );

  // Observe choropleth cards
  choroplethCards.forEach((card) => choroplethObserver.observe(card));

  const peaceCards = document.querySelectorAll('.card[data-viz="peace"]');

  // Track current active step to prevent flickering
  let currentPeaceStep = 0;

  const peaceObserver = new IntersectionObserver(
    (entries) => {
      // Find the most visible intersecting card
      let mostVisible = null;
      let maxRatio = 0;

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          mostVisible = entry.target;
          maxRatio = entry.intersectionRatio;
        }
      });

      // Only update if we found a visible card AND it's significantly more visible
      if (mostVisible) {
        const newStep = parseInt(mostVisible.dataset.step);

        // Only switch steps if it's different AND new card is at least 30% visible
        if (newStep !== currentPeaceStep && maxRatio > 0.3) {
          currentPeaceStep = newStep;

          peaceCards.forEach((card) => card.classList.remove("active"));
          mostVisible.classList.add("active");

          console.log("Peace map active step:", newStep);
          peaceMap.highlightStep(newStep);
        }
      }
    },
    {
      threshold: [0, 0.25, 0.5, 0.75, 1],
      rootMargin: "0px",
    },
  );

  // Observe peace cards
  peaceCards.forEach((card) => peaceObserver.observe(card));

  const tradeCards = document.querySelectorAll('.card[data-viz="trade"]');

  // Track current active step to prevent flickering
  let currentTradeStep = 0;

  const tradeObserver = new IntersectionObserver(
    (entries) => {
      // Find the most visible intersecting card
      let mostVisible = null;
      let maxRatio = 0;

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          mostVisible = entry.target;
          maxRatio = entry.intersectionRatio;
        }
      });

      // Only update if we found a visible card AND it's significantly more visible
      if (mostVisible) {
        const newStep = parseInt(mostVisible.dataset.step);

        // Only switch steps if it's different AND new card is at least 30% visible
        if (newStep !== currentTradeStep && maxRatio > 0.3) {
          currentTradeStep = newStep;

          tradeCards.forEach((card) => card.classList.remove("active"));
          mostVisible.classList.add("active");

          console.log("Trade chart active step:", newStep);
          // No transitions - chart is static
        }
      }
    },
    {
      threshold: [0, 0.25, 0.5, 0.75, 1],
      rootMargin: "0px",
    },
  );

  // Observe trade cards
  tradeCards.forEach((card) => tradeObserver.observe(card));

  // Setup observers for mapdot scrollytelling with scroll-bound animations
  const mapdotCards = document.querySelectorAll('.card[data-viz="mapdot"]');

  // Track current active step to prevent flickering
  let currentMapdotStep = 0;

  const mapdotObserver = new IntersectionObserver(
    (entries) => {
      // Find the most visible intersecting card
      let mostVisible = null;
      let maxRatio = 0;

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          mostVisible = entry.target;
          maxRatio = entry.intersectionRatio;
        }
      });

      // Only update if we found a visible card AND it's significantly more visible
      if (mostVisible) {
        const newStep = parseInt(mostVisible.dataset.step);

        // Only switch steps if it's different AND new card is at least 30% visible
        if (newStep !== currentMapdotStep && maxRatio > 0.3) {
          currentMapdotStep = newStep;

          mapdotCards.forEach((card) => card.classList.remove("active"));
          mostVisible.classList.add("active");

          console.log("Mapdot active step:", newStep);

          if (newStep < 2) {
            // Steps 0-1: Stay in map view, no scroll animation
            mapDotPlot.stopScrollAnimation();
            // Set to map view instantly (progress = 0 means full map view)
            if (mapDotPlot.isScatterView) {
              mapDotPlot.setTransitionProgress(true, 0);
              mapDotPlot.isScatterView = false;
            }
          } else if (newStep === 2) {
            // Step 2: The transition card - animate from map to scatter
            mapDotPlot.startScrollAnimation(mostVisible, "toScatter");
          } else {
            // Steps 3+: Stay in scatter view, no scroll animation
            mapDotPlot.stopScrollAnimation();
            // Set to scatter view instantly (progress = 1 means full scatter view)
            if (!mapDotPlot.isScatterView) {
              mapDotPlot.setTransitionProgress(true, 1);
              mapDotPlot.isScatterView = true;
            }
          }
        }
      }

      // Handle cards leaving viewport (for step 2 animation cleanup)
      entries.forEach((entry) => {
        const step = parseInt(entry.target.dataset.step);
        if (
          !entry.isIntersecting &&
          step === 2 &&
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
      threshold: [0, 0.25, 0.5, 0.75, 1],
      rootMargin: "0px",
    },
  );

  // Observe mapdot cards
  mapdotCards.forEach((card) => mapdotObserver.observe(card));
});
