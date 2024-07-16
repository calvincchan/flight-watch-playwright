import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import pw from "playwright";

async function main() {
  /** Prepare browser */
  const CDP = process.env.LOCAL_CDP_HOST ?? process.env.CDP_HOST;
  const browser = await pw.chromium.connectOverCDP(CDP, { timeout: 10000 });
  const context = await browser.newContext({
    geolocation: { latitude: 49.2827, longitude: -123.1207 }, // hard code Vancouver
    locale: "en-CA",
  });
  const page = await context.newPage();

  /** Prepare Supabase */
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

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
    await waitForLoading();
  }

  /** Passenger page */
  {
    console.log("Proceeding to the next page...");
    await page.waitForSelector("div.contents.-booking");
    await page.click("button[type=submit]");
    await waitForLoading();
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
      const content_date =
        (await dateElement.getAttribute("data-fulldate")) || "";
      const raw_text = (await dateElement.getAttribute("aria-label")) || "";
      const price = getPrice(raw_text);
      result.push({ content_date, raw_text, price });
    }
    /** Write json file */
    fs.writeFileSync(
      `screenshots/flight-result--${timestamp}.json`,
      JSON.stringify(result, null, 2)
    );
    /** Save to database */
    const { data, error } = await supabase.from("day_record").insert(result);
    if (error) {
      console.error("Error saving to database", error);
    } else {
      console.log("Saved to database", data);
    }

    console.log("Screenshot and json dump done.");
  }

  await delay();
  await browser.close();
}

async function delay(timeout = 1000) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

/** Extract the price from text:
 * "Standard seat - Fri, Aug 2, 2024 - priceC$810.67"
 * "Standard seat - Sun, Jul 28, 2024 - There are no available seats."
 */
function getPrice(rawText) {
  const token = rawText.split(" - ")[2];
  if (token.includes("price")) {
    return token.split("priceC$")[1].replace(",", "");
  } else {
    return null;
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
