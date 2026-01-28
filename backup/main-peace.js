import { PeaceMap } from "./PeaceMap.js";

document.addEventListener("DOMContentLoaded", () => {
  const visualizationElement = document.getElementById("visualization-peace");

  // Initialize the peace map
  const peaceMap = new PeaceMap(visualizationElement);
});
