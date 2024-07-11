import pw from "playwright";

async function main() {
  // default timeout 30 secs
  const browser = await pw.chromium.launch({ headless: false, timeout: 30000 });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://www.zipair.net/en");
  waitForLoading(page);

  {
    /** take screenshot with timestamp */
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    await page.screenshot({
      path: `screenshots/screenshot--${timestamp}.png`,
      fullPage: true,
    });
  }

  {
    console.log("Clicking on the origin button...");
    await page.waitForSelector(`button[aria-label="Origin (Country, Region)"]`);
    await page.click(`button[aria-label="Origin (Country, Region)"]`);
    await delay(3000);
    await page.waitForSelector("div.app-dialog");
    console.log("Selecting 'Vancouver' as the origin...");
    await page.click("div.destination-list-item:nth-of-type(7) > button");
  }

  await browser.close();
}

async function waitForLoading(page) {
  // Wait for the loading overlay to appear and then disappear
  console.log("Waiting for the loading overlay to appear and disappear...");
  await page
    .waitForSelector("div.app-loading-screen", {
      visible: true,
    })
    .catch((e) => console.log("Loading overlay did not appear, continuing..."));

  await page.waitForSelector("div.app-loading-screen", {
    hidden: true,
  });

  await delay(3000);
}

async function delay(timeout) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

main().catch(console.error);
