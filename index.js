import fs from "fs";
import pw from "playwright";

async function main() {
  // const CDP = process.env.LOCAL_CDP_HOST;
  // const browser = await pw.chromium.connectOverCDP(CDP);
  const CDP = process.env.CDP_HOST;
  const browser = await pw.chromium.connectOverCDP(CDP, { timeout: 10000 });
  const context = await browser.newContext({
    geolocation: { latitude: 49.2827, longitude: -123.1207 }, // hard code Vancouver
    locale: "en-CA",
  });
  const page = await context.newPage();

  async function waitForLoading() {
    // Wait for the loading overlay to appear and then disappear
    console.log("Waiting for the loading overlay to appear and disappear...");
    await page
      .waitForSelector("div.app-loading-screen", { state: "visible" })
      .catch((e) =>
        console.log("Loading overlay did not appear, continuing...")
      );

    await page.waitForSelector("div.app-loading-screen", { state: "hidden" });

    await delay();
  }

  await page.goto("https://www.zipair.net/en");
  await waitForLoading();

  {
    /** Cookie agreement */
    console.log("Accepting cookies...");
    await page.click("div.cookie-banner button.button");
  }

  {
    console.log("Clicking on the origin button...");
    await page.waitForSelector(`button[aria-label="Origin (Country, Region)"]`);
    await page.click(`button[aria-label="Origin (Country, Region)"]`);
    await delay();
    await page.waitForSelector("div.app-dialog");
    console.log("Selecting 'Vancouver' as the origin...");
    await page.click("div.destination-list-item:nth-of-type(7) > button");
  }

  await delay();

  {
    console.log("Clicking on the destination button...");
    await page.waitForSelector(
      `button[aria-label="Destination (Country, Region)"]`
    );
    await page.click(`button[aria-label="Destination (Country, Region)"]`);
    await delay(1000);
    await page.waitForSelector("div.app-dialog");
    console.log("Selecting 'Tokyo' as the origin...");
    await page.click("div.destination-list-item:nth-of-type(1) > button");
  }

  await delay();

  {
    console.log("Clicking search...");
    await page.click("div.search > button");
    await delay();
  }

  {
    console.log("Clicking next in the popup");
    await page.waitForSelector("div.app-popup", { state: "visible" });
    await page.click("div.app-popup button.button");
    // await page.waitForNavigation({ waitUntil: "networkidle0" });
    await page.waitForSelector("div.app-popup", { state: "hidden" });
    await waitForLoading(page);
  }

  /** Passenger page */
  {
    console.log("Proceeding to the next page...");
    await page.waitForSelector("div.contents.-booking");
    await page.click("button[type=submit]");
    await waitForLoading(page);
  }

  /** Flight result page. Scroll down to fetch ahead for a few months */
  {
    console.log("Scrolling down to fetch more flight dates...");
    for (let i = 0; i < 5; i++) {
      //scroll down to the bottom of the page
      await delay();
      // Scroll the page to the bottom
      await page.evaluate(() => {
        window.scrollBy(0, document.body.scrollHeight);
      });
    }
  }

  await delay();

  const result = [];

  {
    /** take screenshot with timestamp */
    console.log("Taking screenshot...");
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    await page.screenshot({
      path: `screenshots/screenshot--${timestamp}.png`,
      fullPage: true,
    });

    /** dump json */
    console.log("Dumping json...");
    const dateElements = await page.locator("button.date").all();
    for (const dateElement of dateElements) {
      const fulldate = await dateElement.getAttribute("data-fulldate");
      const value = await dateElement.getAttribute("aria-label");
      result.push({ fulldate, value });
    }
    /** Write json file */
    fs.writeFileSync(
      `screenshots/flight-result--${timestamp}.json`,
      JSON.stringify(result, null, 2)
    );

    console.log("Screenshot and json dump done.");
  }

  await delay();
  await browser.close();

  /** Check dates and set alerts */
}

export async function delay(timeout = 1000) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
