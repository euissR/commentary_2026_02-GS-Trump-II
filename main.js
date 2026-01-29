import { DotMapPlot } from "./DotMapPlot.js";
import { PeaceMap } from "./PeaceMap.js";
import { ChoroplethMap } from "./ChoroplethMap.js";
import { TradeChart } from "./TradeChart.js";

document.addEventListener("DOMContentLoaded", () => {
  // Initialize all visualizations
  const dotMapElement = document.getElementById("visualization-dotmap");
  const peaceMapElement = document.getElementById("visualization-peace");
  const choroplethMapElement = document.getElementById(
    "visualization-choropleth",
  );
  const tradeMapElement = document.getElementById("visualization-trade");

  const dotMapPlot = new DotMapPlot(dotMapElement);
  const peaceMap = new PeaceMap(peaceMapElement);
  const choroplethMap = new ChoroplethMap(choroplethMapElement);
  const tradeChart = new TradeChart(tradeMapElement);

  // Setup observers for dotmap scrollytelling
  const dotmapCards = document.querySelectorAll('.card[data-viz="dotmap"]');
  const dotmapObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // Remove active class from dotmap cards
        dotmapCards.forEach((card) => card.classList.remove("active"));

        if (entry.isIntersecting) {
          entry.target.classList.add("active");
          const step = parseInt(entry.target.dataset.step);

          console.log("Dotmap active step:", step);

          // Handle dotmap transitions
          if (step >= 2) {
            dotMapPlot.toggleView(true, step);
          } else {
            if (dotMapPlot.isMapView) {
              dotMapPlot.toggleView(false, step);
            }
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

  // Setup observers for choropleth scrollytelling
  const choroplethCards = document.querySelectorAll(
    '.card[data-viz="choropleth"]',
  );
  const choroplethObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // Remove active class from choropleth cards
        choroplethCards.forEach((card) => card.classList.remove("active"));

        if (entry.isIntersecting) {
          entry.target.classList.add("active");
          const step = parseInt(entry.target.dataset.step);

          console.log("Choropleth active step:", step);

          // Handle choropleth transitions
          if (step >= 2) {
            choroplethMap.toggleView(true, step);
          } else {
            if (choroplethMap.currentView === "continuous") {
              choroplethMap.toggleView(false, step);
            }
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
        // Remove active class from peace cards
        peaceCards.forEach((card) => card.classList.remove("active"));

        if (entry.isIntersecting) {
          entry.target.classList.add("active");
          const step = parseInt(entry.target.dataset.step);

          console.log("Peace map active step:", step);

          // Highlight the corresponding peace agreement
          if (step > 0) {
            peaceMap.highlightStep(step - 1); // -1 because step 0 is intro
          }
        }
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
        tradeCards.forEach((card) => card.classList.remove("active"));

        if (entry.isIntersecting) {
          entry.target.classList.add("active");
          const step = parseInt(entry.target.dataset.step);

          console.log("Trade chart active step:", step);

          // Transition to area chart at step 2 or later
          if (step >= 2) {
            tradeChart.toggleView(true, step);
          } else {
            if (tradeChart.currentView === "zoomed") {
              tradeChart.toggleView(false, step);
            }
          }
        }
      });
    },
    {
      threshold: 0.5,
      rootMargin: "0px",
    },
  );

  // Observe trade cards
  tradeCards.forEach((card) => tradeObserver.observe(card));
});
