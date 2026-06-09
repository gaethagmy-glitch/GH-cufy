const fs = require('fs');
const readline = require('readline');

const logPath = "C:\\Users\\Gaith\\.gemini\\antigravity\\brain\\3fb28034-61a2-4a75-ade7-59b01e4507a6\\.system_generated\\logs\\transcript.jsonl";

const fileStream = fs.createReadStream(logPath);

const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

let part1 = "";
let part2 = "";

rl.on('line', (line) => {
  try {
    const data = JSON.parse(line);
    if (data.step_index === 6) {
      const content = data.content || "";
      const marker = "Showing lines 1 to 800\nThe following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.\n";
      const idx = content.indexOf(marker);
      if (idx !== -1) {
        const linesText = content.substring(idx + marker.length);
        const lines = linesText.split(/\r?\n/);
        for (const l of lines) {
          if (l.trim()) {
            const colIdx = l.indexOf(':');
            if (colIdx !== -1) {
              // Note: the line has a space after the colon, so we slice from colIdx + 2
              part1 += l.substring(colIdx + 2) + "\r\n";
            }
          }
        }
      }
    } else if (data.step_index === 8) {
      const content = data.content || "";
      const marker = "Showing lines 800 to 1355\nThe following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.\n";
      const idx = content.indexOf(marker);
      if (idx !== -1) {
        const linesText = content.substring(idx + marker.length);
        const lines = linesText.split(/\r?\n/);
        for (const l of lines) {
          if (l.trim()) {
            const colIdx = l.indexOf(':');
            if (colIdx !== -1) {
              part2 += l.substring(colIdx + 2) + "\r\n";
            }
          }
        }
      }
    }
  } catch (e) {
    // Ignore malformed JSON lines if any
  }
});

rl.on('close', () => {
  fs.writeFileSync("original_index.html", part1 + part2, "utf-8");
  console.log("Original index.html reconstructed successfully!");
});
