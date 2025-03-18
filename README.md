# Arc Bookmarks Export Tool

A simple web tool that converts Arc Browser bookmark collections to standard HTML bookmark files that can be imported in other browsers like Chrome, Firefox, Safari, etc.

## Features

- Directly enter Arc sharing URLs (even with @ prefix)
- Paste HTML content from Arc sharing pages
- Automatically detects Arc URLs in clipboard
- Preserves folder structure and organization
- Downloads standard browser-compatible bookmarks file

## How to Use

1. Copy an Arc Browser sharing link (e.g., `https://arc.net/folder/...`)
2. Paste it into the URL field and click "Fetch & Convert"
3. Download the generated bookmarks file
4. Import the file into your browser of choice

## Limitations

- URL fetching might be affected by CORS restrictions
- If URL fetching fails, you can use the "Paste HTML" option instead

## License

MIT 