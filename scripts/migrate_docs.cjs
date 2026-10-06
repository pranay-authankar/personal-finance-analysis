const fs = require('fs');
const path = require('path');

const uploadsDir = path.resolve(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const docsCsvPath = path.resolve(__dirname, '..', 'data', 'documents.csv');
if (fs.existsSync(docsCsvPath)) {
  const content = fs.readFileSync(docsCsvPath, 'utf8');
  const lines = content.split('\n');
  if (lines.length > 0) {
    const newLines = [lines[0].trim()]; // header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // Check if line contains a data:image base64
      if (line.includes('data:image')) {
        const parts = line.split(',');
        const d_id = parts[0].replace(/"/g, '');
        const a_id = parts[1].replace(/"/g, '');
        const r_id = parts[2].replace(/"/g, '');
        const d_category = parts[3].replace(/"/g, '');
        const d_name = parts[4].replace(/"/g, '');
        
        // Find base64 match
        const match = line.match(/data:image\/([a-zA-Z0-9]+);base64,([^"]+)/);
        if (match) {
          const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
          const b64Data = match[2];
          const filename = `${d_id}.${ext}`;
          const filePath = path.join(uploadsDir, filename);
          fs.writeFileSync(filePath, Buffer.from(b64Data, 'base64'));
          console.log(`Extracted base64 to ${filePath}`);
          newLines.push(`${d_id},${a_id},${r_id},${d_category},${d_name},/uploads/${filename}`);
        } else {
          newLines.push(line);
        }
      } else {
        newLines.push(line);
      }
    }
    fs.writeFileSync(docsCsvPath, newLines.join('\n') + '\n', 'utf8');
    console.log(`documents.csv updated to file references.`);
  }
}
