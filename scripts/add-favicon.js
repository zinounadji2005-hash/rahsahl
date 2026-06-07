// Add favicon link to all HTML files in public/
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const HTML_FILES = [];

function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.isFile() && f.name.endsWith('.html')) HTML_FILES.push(p);
  }
}
walk(PUBLIC_DIR);

const FAVICON_TAG = '<link rel="icon" type="image/svg+xml" href="__PATH__favicon.svg">';

function relativePathToAssets(htmlFile) {
  const rel = path.relative(path.dirname(htmlFile), path.join(PUBLIC_DIR, 'assets'));
  const withSep = rel.endsWith(path.sep) ? rel : rel + path.sep;
  return withSep.split(path.sep).join('/');
}

let added = 0, skipped = 0, failed = 0;

for (const file of HTML_FILES) {
  try {
    let content = fs.readFileSync(file, 'utf8');
    // Remove any prior favicon link (clean slate for re-runs)
    content = content.replace(/<link rel="icon"[^>]*>\n?/g, '');
    const rel = relativePathToAssets(file);
    const tag = FAVICON_TAG.replace('__PATH__', rel);
    if (content.includes('</title>')) {
      content = content.replace('</title>', '</title>\n' + tag);
    } else if (content.includes('<head>')) {
      content = content.replace('<head>', '<head>\n' + tag);
    } else {
      throw new Error('no <head> or </title> found');
    }
    fs.writeFileSync(file, content);
    console.log('ADD   ' + path.relative(PUBLIC_DIR, file) + '  →  ' + tag.trim());
    added++;
  } catch (err) {
    console.error('FAIL  ' + path.relative(PUBLIC_DIR, file) + '  →  ' + err.message);
    failed++;
  }
}

console.log('\n' + added + ' added, ' + skipped + ' skipped, ' + failed + ' failed');
