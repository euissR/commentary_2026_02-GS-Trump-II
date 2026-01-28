import { DotMapPlot } from "./DotMapPlot.js";

document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".card");
  const visualizationElement = document.getElementById("visualization-dotmap");

  // Initialize visualization
  const dotMapPlot = new DotMapPlot(visualizationElement);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // Remove active class from all cards
        cards.forEach((card) => card.classList.remove("active"));

        if (entry.isIntersecting) {
          entry.target.classList.add("active");
          const step = parseInt(entry.target.dataset.step);

          console.log("Active step:", step);

          // Handle visualization transitions based on step
          if (step >= 2) {
            // Transition to map view starting at step 2
            dotMapPlot.toggleView(true, step);
          } else {
            // Stay in dot plot view for steps 0-1
            if (dotMapPlot.isMapView) {
              dotMapPlot.toggleView(false, step);
            }
          }
        }
      });
    },
    {
      threshold: 0.5, // Trigger when 50% of the card is visible
      rootMargin: "0px",
    }
  );

  // Observe all cards
  cards.forEach((card) => observer.observe(card));
});
