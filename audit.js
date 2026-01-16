import fs from 'fs';
import path from 'path';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import puppeteer from 'puppeteer';

(async () => {
  // 1. Capture URL
  const targetUrl = process.argv[2];
  if (!targetUrl) {
    console.error('❌ Error: Please provide a URL.');
    console.error('Usage: node audit.js "https://your-url.com"');
    process.exit(1);
  }

  // 2. Setup Output Directory
  const outputDir = 'output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  // 3. Define Configurations for Mobile vs Desktop
  const configurations = [
    {
      mode: 'mobile',
      config: undefined // Default Lighthouse config is Mobile
    },
    {
      mode: 'desktop',
      config: {
        extends: 'lighthouse:default',
        settings: {
          formFactor: 'desktop',
          screenEmulation: {
            mobile: false,
            width: 1350,
            height: 940,
            deviceScaleFactor: 1,
            disabled: false,
          },
        }
      }
    }
  ];

  console.log(`🚀 Starting audit for: ${targetUrl}\n`);

  // 4. Loop through modes (Mobile then Desktop)
  for (const { mode, config } of configurations) {
    console.log(`[${mode.toUpperCase()}] Launching Chrome...`);
    
    // Launch Chrome
    const chrome = await chromeLauncher.launch({chromeFlags: ['--headless']});
    const options = {logLevel: 'silent', output: 'html', port: chrome.port};
    
    // Run Lighthouse
    console.log(`[${mode.toUpperCase()}] Running audit...`);
    const runnerResult = await lighthouse(targetUrl, options, config);
    const reportHtml = runnerResult.report;
    const score = runnerResult.lhr.categories.performance.score * 100;

    // Generate Filenames
    const safeName = targetUrl
      .replace(/^https?:\/\//, '')
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const baseFilename = `${safeName}-${mode}`;
    const htmlPath = path.join(outputDir, `${baseFilename}.html`);
    const pdfPath = path.join(outputDir, `${baseFilename}.pdf`);

    // Save HTML (User requested this)
    fs.writeFileSync(htmlPath, reportHtml);
    console.log(`[${mode.toUpperCase()}] HTML saved: ${htmlPath}`);

    // Convert to PDF
    console.log(`[${mode.toUpperCase()}] Converting to PDF...`);
    await chrome.kill(); // Kill Lighthouse's Chrome before starting Puppeteer

    const browser = await puppeteer.launch({headless: 'new'});
    const page = await browser.newPage();
    
    // Load the saved HTML file directly
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
    });

    await browser.close();
    console.log(`[${mode.toUpperCase()}] PDF saved: ${pdfPath}`);
    console.log(`[${mode.toUpperCase()}] Performance Score: ${score.toFixed(0)}\n` + '-'.repeat(30));
  }

  console.log('✨ All audits complete!');
})();