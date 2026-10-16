import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/bricolage-grotesque/latin-600.css";
import "@fontsource/bricolage-grotesque/latin-800.css";
import "@fontsource/instrument-sans/latin-400.css";
import "@fontsource/instrument-sans/latin-600.css";
import "./styles/tokens.css";
import "./styles/app.css";
import PokerKasten from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PokerKasten />
  </StrictMode>
);
