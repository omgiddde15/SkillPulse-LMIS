const path = require('path');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '..', 'frontend', 'node_modules', 'puppeteer-core'));

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function inspectReferenceOverview() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto('https://kaushalpulse.vercel.app/overview', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));

  const pageDetails = await page.evaluate(() => {
    // Collect all main sections and cards
    const main = document.querySelector('main') || document.body;
    
    // Top bar / header
    const headers = Array.from(document.querySelectorAll('header, [class*="header"]')).map(el => el.innerText.trim()).slice(0, 5);
    
    // All cards
    const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="panel"], section, article')).map(el => ({
      tagName: el.tagName,
      className: el.className,
      text: el.innerText.trim().slice(0, 300)
    })).filter(c => c.text.length > 20);

    // Context filter elements
    const selects = Array.from(document.querySelectorAll('select')).map(s => ({
      id: s.id,
      name: s.name,
      options: Array.from(s.options).map(o => o.text).slice(0, 10)
    }));

    // Buttons
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);

    return {
      bodyText: document.body.innerText,
      selects,
      buttons,
      cards: cards.slice(0, 20)
    };
  });

  await browser.close();

  fs.writeFileSync(path.resolve(__dirname, '..', 'screenshots', 'reference-parity', 'ref_overview_deep_inspection.json'), JSON.stringify(pageDetails, null, 2), 'utf8');
  console.log('Reference Overview detailed inspection written.');
}

inspectReferenceOverview();
