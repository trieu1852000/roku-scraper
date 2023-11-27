const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

async function performScraping() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const rokuItems = [];

    try {
        for (let pageNum = 31; pageNum <= 35; pageNum++) { //choose page number I want to extract data from Roku
            const pageUrl = `https://www.roku.com/api/v1/sow/search?series=1&page=${pageNum}`;
            await page.goto(pageUrl, { waitUntil: 'networkidle0' });

            const pageContent = await page.content();
            const $ = cheerio.load(pageContent); 

            const data = JSON.parse($('body').text());
            const numMovies = data.view.length;

            console.log(`Total Movies on Page ${pageNum}: ${numMovies}`);

            for (let i = 0; i < numMovies; i++) {
                const movieData = data.view[i].content;
                const channelIdArray = movieData.viewOptions ? movieData.viewOptions.map(option => option.channelId) : [];
                const contentId = channelIdArray.includes("151908") ? movieData.meta.id : "";

                if (!contentId) {
                    continue;
                }

                //const rokuLink = contentId ? `https://therokuchannel.roku.com/details/${contentId}` : "";

                const moreResponse = await page.goto(`https://www.roku.com/api/v1/sow/content/v1/roku/${contentId}`, { waitUntil: 'networkidle0' });
                let moreResponseData;
                try {
                    moreResponseData = JSON.parse(await moreResponse.text());
                } catch (error) {
                    console.log("Error parsing moreResponseData:", error);
                    continue;
                }
                const initialSeasonApiUrl = `https://therokuchannel.roku.com/api/v2/homescreen/content/https%3A%2F%2Fcontent.sr.roku.com%2Fcontent%2Fv1%2Froku-trc%2F${contentId}%3Fexpand%3Dseasons%26include%3Dseasons.title%252Cseasons.seasonNumber`;
                await page.goto(initialSeasonApiUrl, { waitUntil: 'networkidle0' });

                // Extract JSON data using page.evaluate
                let initialSeasonResponseData;
                try {
                    initialSeasonResponseData = await page.evaluate(() => JSON.parse(document.querySelector("body").innerText));
                    //console.log(initialSeasonResponseData); // Log for debugging
                } catch (error) {
                    console.error("Error extracting initial season data:", error);
                    continue;
                }

                const totalSeasons = initialSeasonResponseData.seasons.length;

                let allSeasonsData = [];

                // Loop through all seasons
                for (let seasonNumber = 1; seasonNumber <= totalSeasons; seasonNumber++) {
                    const seasonApiUrl = `https://therokuchannel.roku.com/api/v2/homescreen/content/https%3A%2F%2Fcontent.sr.roku.com%2Fcontent%2Fv1%2Froku-trc%2F${contentId}%3Fexpand%3Dcredits%252CviewOptions%252CcategoryObjects%252CviewOptions.providerDetails%252Cseries%252Cseason%252Cseason.episodes%252Cnext%252Cepisodes%252Cseasons%252Cseasons.episodes%26include%3Dtype%252Ctitle%252CimageMap.detailPoster%252CimageMap.detailBackground%252Cbobs.detailScreen%252CcategoryObjects%252CrunTimeSeconds%252CcastAndCrew%252Csavable%252CstationDma%252CkidsDirected%252CreleaseDate%252CreleaseYear%252Cdescription%252Cdescriptions%252Cindicators%252Cgenres%252Ccredits.birthDate%252Ccredits.meta%252Ccredits.order%252Ccredits.name%252Ccredits.role%252Ccredits.personId%252Ccredits.images%252CparentalRatings%252CreverseChronological%252CcontentRatingClass%252ClanguageDialogBody%252CdetailScreenOptions%252CviewOptions%252CepisodeNumber%252CseasonNumber%252CsportInfo%252CeventState%252Cseries.title%252Cseason%252Cseasons.title%252Cseasons.seasonNumber%252Cseasons.description%252Cseasons.descriptions%252Cseasons.releaseYear%252Cseasons.castAndCrew%252Cseasons.credits.birthDate%252Cseasons.credits.meta%252Cseasons.credits.order%252Cseasons.credits.name%252Cseasons.credits.role%252Cseasons.credits.personId%252Cseasons.credits.images%252Cseasons.imageMap.detailBackground%252Cseasons.episodes.title%252Cseasons.episodes.description%252Cseasons.episodes.descriptions.40%252Cseasons.episodes.descriptions.60%252Cseasons.episodes.episodeNumber%252Cseasons.episodes.seasonNumber%252Cseasons.episodes.images%252Cseasons.episodes.imageMap.grid%252Cseasons.episodes.indicators%252Cseasons.episodes.releaseDate%252Cseasons.episodes.viewOptions%252Cepisodes.episodeNumber%252Cepisodes.seasonNumber%252Cepisodes.viewOptions%26filter%3DcategoryObjects%253AgenreAppropriate%252520eq%252520true%252Cseasons.episodes%253A%2528not%252520empty%2528viewOptions%2529%2529%253Aall%252Cseasons%253AseasonNumber%2Beq%2B${seasonNumber}%26featureInclude%3Dbookmark%252Cwatchlist%252ClinearSchedule`;
                  

                    await page.goto(seasonApiUrl, { waitUntil: 'networkidle0' });
                    let seasonResponseData;
                    try {
                        seasonResponseData = await page.evaluate(() => JSON.parse(document.querySelector("body").innerText));
                        allSeasonsData.push(...seasonResponseData.seasons);
                    } catch (error) {
                        console.error(`Error parsing data for season ${seasonNumber}:`, error);
                        continue;
                    }
                    


                }

                // Process allSeasonsData to structure it as needed
                const seasons = allSeasonsData.map((season, index) => {
                    const seasonRokuLink = `https://therokuchannel.roku.com/details/${contentId}/season-${index + 1}`;
                    return {
                        season: season.seasonNumber,
                        rokuLink: seasonRokuLink, 
                        episodes: season.episodes.map(episode => {
                            return {
                                episode: episode.episodeNumber,
                                title: episode.title
                            };
                        })
                    };
                });

                // Create an object with the collected data
                const rokuItem = {
                    contentId: contentId,
                    title: movieData.title,
                    description: moreResponseData.view.description,
                    releaseDate: movieData.extra,
                    directors: moreResponseData.view.credits.find(credit => credit.role === "DIRECTOR")?.name,
                    sourceId: 1237,
                    //rokuLink: rokuLink,
                    device: "R",
                    seasons: seasons
                };

                rokuItems.push(rokuItem);
            }
        }

        let existingData = [];
        if (fs.existsSync('show.json')) {
            existingData = JSON.parse(fs.readFileSync('show.json'));
        }

        // Append the newly collected data to the existing data
        const combinedData = existingData.concat(rokuItems);

        // Write the combined data back to the JSON file
        fs.writeFileSync('show.json', JSON.stringify(combinedData, null, 2));
        console.log('Data has been extracted and saved to show.json');
    } catch (error) {
        console.error("Error:", error);
    } finally {
        // Close the Puppeteer browser when done
        await browser.close();
    }
}

performScraping();
