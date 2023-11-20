const cheerio = require("cheerio");
const axios = require("axios");
const fs = require("fs");



async function performScraping() {

    try {
        // downloading the target web page
        // by performing an HTTP GET request in Axios
        const rokuItems = []
        const axiosResponse = await axios.request({
            method: "GET",
            accept: "application/json",
            url:"https://www.roku.com/api/v1/sow/search"
        })
        
        //console.log(axiosResponse.data)    //(finding property for axiosResponse.data below)
        const data = axiosResponse.data
        const numMovies = data.view.length;
        console.log(`Total Movies: ${numMovies}`);
        
        // Loop through all movies and collect data
        for (let i = 0; i < numMovies; i++) {
            const movieData = data.view[i].content;
            const channelIdArray = movieData.viewOptions.map(option => option.channelId);
            const contentId = channelIdArray.includes("151908") ? movieData.meta.id : "";
            // skip the movie that no valid contentId
            if (!contentId) {
                //console.log(`Skipping movie: ${movieData.title} (No valid contentId)`);
                continue;
            }
        
            const rokuLink = contentId ? `https://therokuchannel.roku.com/details/${contentId}` : "";

            console.log(`Processing movie: ${movieData.title}, contentId: ${contentId}`);
            
            // Add code to fetch director data
            const moreResponse = await axios.request({
                method:"GET",
                accept: "application/json",
                url:`https://www.roku.com/api/v1/sow/content/v1/roku/${contentId}`
            });
            const directorData = moreResponse.data.view.credits.find(credit => credit.role === "DIRECTOR");
            const directorName = directorData ? directorData.name : "";

            // Extract the description from moreResponse
            const description = moreResponse.data.view.description;

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
        fs.writeFileSync('titles.json', JSON.stringify(rokuItems, null, 2));

        //console.log(rokuItem.title)
        //var fileCount
        //fs.readdir("./data", (err, file) => {
          //  fileCount = file.length 
         //   console.log(fileCount)
        //})
        //console.log(fileCount)
        //fs.writeFile(`./data/titles${fileCount}.json`.toString(), JSON.stringify(rokuItems, null, 2));


        //console.log(axiosResponse.data['feed/search?movies=1'][0].view)
        //console.log(axiosResponse.request)
        console.log('Data has been extracted and saved to titles.json');
        
    } catch (error) {
        console.error("Error:", error);
    }
}

performScraping();
