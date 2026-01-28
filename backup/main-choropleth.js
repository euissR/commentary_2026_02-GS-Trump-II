import { ChoroplethMap } from "./ChoroplethMap.js";

document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".card");
  const visualizationElement = document.getElementById("visualization-choropleth");

  // Initialize visualization
  const choroplethMap = new ChoroplethMap(visualizationElement);

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
            // Transition to continuous (rate) view starting at step 2
            choroplethMap.toggleView(true, step);
          } else {
            // Stay in categorical (cat) view for steps 0-1
            if (choroplethMap.currentView === "continuous") {
              choroplethMap.toggleView(false, step);
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
