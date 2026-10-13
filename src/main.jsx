import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PokerKasten from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PokerKasten />
  </StrictMode>
);
