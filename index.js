import puppeteer from 'puppeteer-extra';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import fs from 'fs';
import nodemailer from "nodemailer"; // npm install nodemailer
import dotenv from 'dotenv';  // npm install dotenv
dotenv.config();

import searchParams from './searchParams.js';

puppeteer.use(AdblockerPlugin());


const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_TO = process.env.EMAIL_TO;

// https://www.youtube.com/watch?v=ud3j4bCUD50&t=305s&ab_channel=bufahad
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    type: "login", // add this line
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
  authMethod: "PLAIN", // add this line PLAIN or LOGIN?
});

async function sendEmail(to, subject, text) {
  try {
    const mailOptions = {
      from: "Gediminas Vilbeta <info.vilbeta@gmail.com>",
      to,
      subject,
      text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`sending email from ${EMAIL_USER} to ${EMAIL_TO}`);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

async function scrapeVehicleData() {
(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://soov.ee/577-autod/3/listings.html');
  
    const vehicles = await page.$$eval('.item-list', (items) =>
      items.map((item) => {
        const dataIid = item.id.substring(1);
        const titleElement = item.querySelector('.add-title a');
        const titleText = titleElement?.textContent.trim() ?? 'n/a';
        const normalizedTitle = titleText.toLowerCase().replace(/[^a-z0-9]/g, '');
        const link = titleElement?.href ?? 'n/a';
        const yearMatch = titleText.match(/\b\d{4}\b/);
        const year = yearMatch ? yearMatch[0] : 'n/a';
        return { dataIid, titleText, normalizedTitle, link, year };
      })
    );
    // console.log('Vehicle data extracted:', vehicles);

  let allVehicles = [];

  try {
    const fileData = fs.readFileSync('searchResults.json', 'utf8');
    allVehicles = JSON.parse(fileData);
  } catch (error) {
    console.log('Error reading searchResults.json:', error.message);
  }

  let foundVehiclesCount = 0;

  for (const vehicle of vehicles) {
    const matchedSearchParams = searchParams.find(searchParam => {
      const { make, model, years } = searchParam;
      const makeMatch = make && vehicle.normalizedTitle.includes(make.toLowerCase());
      const modelMatch = model && vehicle.normalizedTitle.includes(model.toLowerCase());

      const yearMatch = years.some(year => vehicle.normalizedTitle.includes(year));
      return makeMatch && modelMatch && yearMatch;
    });

    if (matchedSearchParams) {
      const existingVehicle = allVehicles.find(v => v.dataIid === vehicle.dataIid);

      if (existingVehicle) {
        console.log(`Already printed vehicle Data-IID: ${vehicle.dataIid} ${existingVehicle.link}`);
      } else {
        console.log(`MATCHED vehicle Data-IID: ${vehicle.dataIid} ${vehicle.link}`);
        allVehicles.push(vehicle);
        foundVehiclesCount++;

        // Send Email
        const emailText = `ID: ${vehicle.dataIid}
        Make: ${matchedSearchParams.make}
        Model: ${matchedSearchParams.model}
        Year: ${vehicle.year}
        Link: ${vehicle.link}`;

        await sendEmail(EMAIL_TO, vehicle.dataIid, emailText);
      }
    }
  }

  console.log(`Found ${foundVehiclesCount} new vehicles matching search parameters...`);

  fs.writeFileSync('searchResults.json', JSON.stringify(allVehicles, null, 2));

  console.log(`Results written to searchResults.json`);

  await browser.close();
})();
}


await scrapeVehicleData();

const intervals = [
  { start: '0 5 * * *', end: '10 10 * * *', min: 3, max: 6  },
  { start: '0 10 * * *', end: '0 12 * * *', min: 3, max: 6 },
  { start: '0 12 * * *', end: '0 14 * * *', min: 1, max: 3 },
  { start: '0 14 * * *', end: '0 17 * * *', min: 3, max: 6 },
  { start: '0 17 * * *', end: '0 19 * * *', min: 1, max: 3 },
  { start: '0 19 * * *', end: '0 23 * * *', min: 3, max: 6 },
  { start: '0 23 * * *', end: '0 5 * * *', min: 3, max: 6 },
];


const now = new Date();

function getRandomInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour12: false });
}

function scheduleJob() {
  const intervalSeconds = getRandomInterval(60, 300);
  const interval = intervalSeconds * 1000; // Convert to milliseconds

  setTimeout(() => {
    const now = new Date();
    const nextRun = new Date(now.getTime() + interval);
    console.log(`${formatTime(now)} `);
    scrapeVehicleData();
    console.log(`Next scheduled run: ${formatTime(nextRun)}`);
    console.log(`Time to the next run: ${intervalSeconds} seconds`);
    scheduleJob(); // Reschedule the job after the current one has run
  }, interval);

  console.log(`Job scheduled to run in ${intervalSeconds} seconds`);
}

scheduleJob();