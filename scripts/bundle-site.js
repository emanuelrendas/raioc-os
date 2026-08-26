import fs from 'node:fs';

const pages = ['index', 'about', 'contact', 'advisory', 'instruments', 'intelligence', 'addresses', 'dashboard', 'mission-control'];
const map = {};
for (const p of pages) {
  map[p] = fs.readFileSync(p + '.html', 'utf8');
}

const content = '/**\n * Bundled Static Site Pages for Zero-I/O Serverless Serving\n */\n\nexport const sitePages = ' + JSON.stringify(map, null, 2) + ';\n';
fs.writeFileSync('src/site/site-pages.js', content, 'utf8');

const dashCode = fs.readFileSync('dashboard.html', 'utf8');
const ccContent = '/**\n * RAIOC Executive Command Center (Sprint 3)\n */\n\nexport function renderCommandCenterHtml() {\n  return ' + JSON.stringify(dashCode) + ';\n}\n';
fs.writeFileSync('src/dashboard/command-center-html.js', ccContent, 'utf8');

console.log('Successfully re-bundled static site pages.');
