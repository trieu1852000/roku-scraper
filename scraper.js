const cheerio = require("cheerio");
const axios = require("axios");
const fs = require("fs");

async function performScraping() {
    try {
        // downloading the target web page
        // by performing an HTTP GET request in Axios
        const axiosResponse = await axios.request({
            method: "GET",
            url: "https://www.roku.com/whats-on/search/"
        })

        // parsing the HTML source of the target web page with Cheerio
        const $ = cheerio.load(axiosResponse.data)

        const titles = [];

        $(".sow-grid")
            .find(".sow-name")
            .each((index, element) => {
                // extracting the data of interest
                const title = $(element).text();

                // adding the title to the titles array
                if (title) {
                    titles.push(title);
                }
            })


        const titlesJSON = JSON.stringify(titles);

        // storing titlesJSON in a JSON file
        fs.writeFile('titles.json', titlesJSON, (err) => {
            if (err) {
                console.error('Error writing JSON file:', err);
            } else {
                console.log('JSON file with titles has been written.');
            }
        });

        console.log("Script execution complete");
    } catch (error) {
        console.error("Error:", error);
    }
}

performScraping();
