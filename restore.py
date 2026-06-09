import json

log_path = r"C:\Users\Gaith\.gemini\antigravity\brain\3fb28034-61a2-4a75-ade7-59b01e4507a6\.system_generated\logs\transcript.jsonl"

part1 = ""
part2 = ""

with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        if data.get('step_index') == 6:
            content = data.get('content', '')
            # Extract content after "Showing lines 1 to 800\n"
            marker = "Showing lines 1 to 800\nThe following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.\n"
            idx = content.find(marker)
            if idx != -1:
                lines_text = content[idx + len(marker):]
                # Reconstruct original lines by removing line numbers
                for l in lines_text.splitlines():
                    if l.strip():
                        # split at first colon
                        col_idx = l.find(':')
                        if col_idx != -1:
                            part1 += l[col_idx+1:] + "\n"
        elif data.get('step_index') == 8:
            content = data.get('content', '')
            marker = "Showing lines 800 to 1355\nThe following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.\n"
            idx = content.find(marker)
            if idx != -1:
                lines_text = content[idx + len(marker):]
                # Reconstruct original lines by removing line numbers
                for l in lines_text.splitlines():
                    if l.strip():
                        col_idx = l.find(':')
                        if col_idx != -1:
                            part2 += l[col_idx+1:] + "\n"

# Write the reconstructed original file
with open("original_index.html", "w", encoding="utf-8") as out:
    out.write(part1)
    out.write(part2)

print("Original index.html reconstructed successfully!")
