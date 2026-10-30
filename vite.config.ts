import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages project site path: must match GH_REPO in ghpages.conf
  base: "/bookstorefrontend.github.io/",
  plugins: [react()],
  resolve: {
    alias: {
      // setup aliases if needed
    },
  },
  css: {
    preprocessorOptions: {
      css: {
        // This is where you can include the path to your CSS
        includePaths: ["node_modules"],
      },
    },
  },
});
