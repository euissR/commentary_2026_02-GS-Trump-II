import { DotMapPlot } from "./DotMapPlot.js";
import { PeaceMap } from "./PeaceMap.js";
import { ChoroplethMap } from "./ChoroplethMap.js";

document.addEventListener("DOMContentLoaded", () => {
  // Initialize all visualizations
  const dotMapElement = document.getElementById("visualization-dotmap");
  const peaceMapElement = document.getElementById("visualization-peace");
  const choroplethMapElement = document.getElementById(
    "visualization-choropleth",
  );

  const dotMapPlot = new DotMapPlot(dotMapElement);
  const peaceMap = new PeaceMap(peaceMapElement);
  const choroplethMap = new ChoroplethMap(choroplethMapElement);

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

  // Manage sticky container visibility
  const stickyDotmap = document.getElementById("sticky-dotmap");
  const stickyChoropleth = document.getElementById("sticky-choropleth");
  const dotmapContainer = document.querySelector(".container-dotmap");
  const choroplethContainer = document.querySelector(".container-choropleth");
  const stickyPeace = document.getElementById("sticky-peace");
  const peaceContainer = document.querySelector(".container-peace");

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.target === dotmapContainer) {
          stickyDotmap.style.display = entry.isIntersecting ? "flex" : "none";
        } else if (entry.target === peaceContainer) {
          stickyPeace.style.display = entry.isIntersecting ? "flex" : "none";
        } else if (entry.target === choroplethContainer) {
          stickyChoropleth.style.display = entry.isIntersecting
            ? "flex"
            : "none";
        }
      });
    },
    {
      threshold: 0,
      rootMargin: "0px",
    },
  );

  // Observe the container sections
  sectionObserver.observe(dotmapContainer);
  sectionObserver.observe(peaceContainer);
  sectionObserver.observe(choroplethContainer);
});
