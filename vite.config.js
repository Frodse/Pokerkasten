import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

// Baut dist/sw.js aus src/sw.js und trägt alle Dateien der App ein,
// damit sie ohne Internet startet (siehe src/sw.js).
function serviceWorker() {
  return {
    name: "pokerkasten-sw",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      const built = Object.keys(bundle).filter((f) => f !== "index.html" && !f.endsWith(".map"));
      const pub = readdirSync("public").filter((f) => !f.startsWith("."));
      const files = ["/", ...[...built, ...pub].map((f) => `/${f}`)];
      const version = createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 10);
      const source = readFileSync("src/sw.js", "utf8")
        .replace("self.__PRECACHE__", JSON.stringify(files))
        .replace("self.__VERSION__", JSON.stringify(version));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
});
