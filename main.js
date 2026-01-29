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
          // if (step > 0) {
          //   peaceMap.highlightStep(step - 1); // -1 because step 0 is intro
          // }
          peaceMap.highlightStep(step);
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

          // No transitions - chart is static
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

  // Setup observers for mapdot scrollytelling
  const mapdotCards = document.querySelectorAll('.card[data-viz="mapdot"]');
  const mapdotObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // Remove active class from mapdot cards
        mapdotCards.forEach((card) => card.classList.remove("active"));

        if (entry.isIntersecting) {
          entry.target.classList.add("active");
          const step = parseInt(entry.target.dataset.step);

          console.log("Mapdot active step:", step);

          // Handle mapdot transitions
          if (step >= 2) {
            mapDotPlot.toggleView(true, step);
          } else {
            if (mapDotPlot.isScatterView) {
              mapDotPlot.toggleView(false, step);
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

  // Observe mapdot cards
  mapdotCards.forEach((card) => mapdotObserver.observe(card));
});
