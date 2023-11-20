const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

async function performScraping() {
    // Launch Puppeteer and create a new page
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const rokuItems = [];

    try {
        for (let pageNum = 21; pageNum <= 40; pageNum++) {
            // Construct the URL for the Roku API page
            const pageUrl = `https://www.roku.com/api/v1/sow/search?page=${pageNum}`;
            await page.goto(pageUrl, { waitUntil: 'networkidle0' }); // Load the page

            // Get the page content and parse it using Cheerio
            const pageContent = await page.content();
            const $ = cheerio.load(pageContent);    

            // Parse the JSON data embedded in the page
            const data = JSON.parse($('body').text());

            // Get the number of movies on the current page
            const numMovies = data.view.length;
            console.log(`Total Movies on Page ${pageNum}: ${numMovies}`);

            // Loop through each movie on the page and collect data
            for (let i = 0; i < numMovies; i++) {
                const movieData = data.view[i].content;
                const channelIdArray = movieData.viewOptions.map(option => option.channelId);
                const contentId = channelIdArray.includes("151908") ? movieData.meta.id : "";

                if (!contentId) {
                    continue; // Skip movies without a valid contentId
                }

                const rokuLink = contentId ? `https://therokuchannel.roku.com/details/${contentId}` : "";

                // Fetch additional details from the content API
                const moreResponse = await page.goto(`https://www.roku.com/api/v1/sow/content/v1/roku/${contentId}`, { waitUntil: 'networkidle0' });
                const moreResponseData = JSON.parse(await moreResponse.text());

                // Find the director's name in the additional data
                const directorData = moreResponseData.view.credits.find(credit => credit.role === "DIRECTOR");
                const directorName = directorData ? directorData.name : "";

                // Extract the movie description from the additional data
                const description = moreResponseData.view.description;

                // Create an object with the collected data and add it to the list
                const rokuItem = {
                    "contentId": contentId,
                    "title": movieData.title,
                    "description": description,
                    "releaseDate": movieData.extra,
                    "directors": directorName,
                    "rokuLink": rokuLink,
                    "sourceId": 1237,
                    "device": "R"
                };
                rokuItems.push(rokuItem);
            }
        }

        // Read the existing data from the JSON file (if it exists)
        let existingData = [];
        if (fs.existsSync('titles.json')) {
            existingData = JSON.parse(fs.readFileSync('titles.json'));
        }

        // Append the newly collected data to the existing data
        const combinedData = existingData.concat(rokuItems);

        // Write the combined data back to the JSON file
        fs.writeFileSync('titles.json', JSON.stringify(combinedData, null, 2));
        console.log('Data has been extracted and saved to titles.json');
    } catch (error) {
        console.error("Error:", error);
    } finally {
        // Close the Puppeteer browser when done
        await browser.close();
    }
}

performScraping();
