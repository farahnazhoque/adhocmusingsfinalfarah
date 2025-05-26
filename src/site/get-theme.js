require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const crypto = require("crypto");
const {globSync} = require("glob");

const themeCommentRegex = /\/\*[\s\S]*?\*\//g;

async function getTheme() {
  let themeUrl = process.env.THEME;
  if (!themeUrl) {
    console.log("No theme URL provided in environment variables. Skipping theme download.");
    return;
  }

  //https://forum.obsidian.md/t/1-0-theme-migration-guide/42537
  //Not all themes with no legacy mark have a theme.css file, so we need to check for it
  let themeData = null;
  let error = null;

  try {
    // Try theme.css first
    try {
      const res = await axios.get(themeUrl);
      themeData = res.data;
    } catch (e) {
      // If theme.css fails, try obsidian.css
      const altUrl = themeUrl.includes("theme.css") 
        ? themeUrl.replace("theme.css", "obsidian.css")
        : themeUrl.replace("obsidian.css", "theme.css");
      
      try {
        const res = await axios.get(altUrl);
        themeData = res.data;
      } catch (e2) {
        error = e2;
      }
    }

    if (!themeData) {
      throw error || new Error("Failed to fetch theme from both URLs");
    }

    // Clean up existing theme files
    try {
      const existing = globSync("src/site/styles/_theme.*.css");
      existing.forEach((file) => {
        fs.rmSync(file);
      });
    } catch (e) {
      console.warn("Warning: Could not clean up existing theme files:", e.message);
    }

    // Process theme data
    let skippedFirstComment = false;
    const processedData = themeData.replace(themeCommentRegex, (match) => {
      if (skippedFirstComment) {
        return "";
      } else {
        skippedFirstComment = true;
        return match;
      }
    });

    // Generate hash and save file
    const hashSum = crypto.createHash("sha256");
    hashSum.update(processedData);
    const hex = hashSum.digest("hex");
    const outputPath = `src/site/styles/_theme.${hex.substring(0, 8)}.css`;
    
    fs.writeFileSync(outputPath, processedData);
    console.log(`Successfully downloaded and saved theme to ${outputPath}`);
  } catch (error) {
    console.error("Error downloading theme:", error.message);
    console.log("Continuing build without theme...");
  }
}

getTheme().catch(error => {
  console.error("Fatal error in get-theme:", error);
  process.exit(1);
});
