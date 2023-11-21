const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

async function performScraping() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const rokuItems = [];

    try {
        for (let pageNum = 1; pageNum <= 1; pageNum++) { // Change the page limit as needed
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

                const rokuLink = contentId ? `https://therokuchannel.roku.com/details/${contentId}` : "";

                const moreResponse = await page.goto(`https://www.roku.com/api/v1/sow/content/v1/roku/${contentId}`, { waitUntil: 'networkidle0' });
                let moreResponseData;
                try {
                    moreResponseData = JSON.parse(await moreResponse.text());
                } catch (error) {
                    console.log("Error parsing moreResponseData:", error);
                    continue;
                }

                const episodeResponse = await page.goto(`https://therokuchannel.roku.com/api/v2/homescreen/content/https%3A%2F%2Fcontent.sr.roku.com%2Fcontent%2Fv1%2Froku-trc%2F${contentId}%3Fexpand%3Dcredits%252CviewOptions%252CcategoryObjects%252CviewOptions.providerDetails%252Cseries%252Cseason%252Cseason.episodes%252Cnext%252Cepisodes%252Cseasons%252Cseasons.episodes%26include%3Dtype%252Ctitle%252CimageMap.detailPoster%252CimageMap.detailBackground%252Cbobs.detailScreen%252CcategoryObjects%252CrunTimeSeconds%252CcastAndCrew%252Csavable%252CstationDma%252CkidsDirected%252CreleaseDate%252CreleaseYear%252Cdescription%252Cdescriptions%252Cindicators%252Cgenres%252Ccredits.birthDate%252Ccredits.meta%252Ccredits.order%252Ccredits.name%252Ccredits.role%252Ccredits.personId%252Ccredits.images%252CparentalRatings%252CreverseChronological%252CcontentRatingClass%252ClanguageDialogBody%252CdetailScreenOptions%252CviewOptions%252CepisodeNumber%252CseasonNumber%252CsportInfo%252CeventState%252Cseries.title%252Cseason%252Cseasons.title%252Cseasons.seasonNumber%252Cseasons.description%252Cseasons.descriptions%252Cseasons.releaseYear%252Cseasons.castAndCrew%252Cseasons.credits.birthDate%252Cseasons.credits.meta%252Cseasons.credits.order%252Cseasons.credits.name%252Cseasons.credits.role%252Cseasons.credits.personId%252Cseasons.credits.images%252Cseasons.imageMap.detailBackground%252Cseasons.episodes.title%252Cseasons.episodes.description%252Cseasons.episodes.descriptions.40%252Cseasons.episodes.descriptions.60%252Cseasons.episodes.episodeNumber%252Cseasons.episodes.seasonNumber%252Cseasons.episodes.images%252Cseasons.episodes.imageMap.grid%252Cseasons.episodes.indicators%252Cseasons.episodes.releaseDate%252Cseasons.episodes.viewOptions%252Cepisodes.episodeNumber%252Cepisodes.seasonNumber%252Cepisodes.viewOptions%26filter%3DcategoryObjects%253AgenreAppropriate%252520eq%252520true%252Cseasons.episodes%253A%2528not%252520empty%2528viewOptions%2529%2529%253Aall%252Cseasons%253AseasonNumber%2Beq%2B1%26featureInclude%3Dbookmark%252Cwatchlist%252ClinearSchedule`);
                let episodeResponseData;
                try {
                    episodeResponseData = JSON.parse(await episodeResponse.text());
                } catch (error) {
                    console.error("Error parsing episodeResponseData:", error);
                    continue;
                }
                
                const seasonNumbers = [];

                // Extract the season numbers from episode data
                episodeResponseData.episodes.forEach(episode => {
                    const seasonNumber = episode.seasonNumber;
                    seasonNumbers.push(seasonNumber);
                });
                
                // Remove duplicate season numbers
                const uniqueSeasonNumbers = [...new Set(seasonNumbers)];

                // Find the director's name in the additional data
                const directorData = moreResponseData.view.credits.find(credit => credit.role === "DIRECTOR");
                const directorName = directorData ? directorData.name : "";

                // Extract the movie description from the additional data
                const description = moreResponseData.view.description;

                // Create an object with the collected data
                const rokuItem = {
                    contentId: contentId,
                    title: movieData.title,
                    description: description,
                    releaseDate: movieData.extra,
                    directors: directorName,
                    sourceId: 1237,
                    rokuLink: rokuLink,
                    device: "R"
                };
                // Create an array to store episodes for each season
                /*rokuItem.seasons = uniqueSeasonNumbers.map(seasonNumber => {
                    const episodesForSeason = episodeResponseData.episodes
                        .filter(episode => episode.seasonNumber === seasonNumber)
                        .map(episode => ({
                            episodeTitle: episode.title,
                            episodeNumber: episode.episodeNumber
                        }));
                    
                    return {
                        season: `season: ${seasonNumber}`,
                        episodes: episodesForSeason
                    };
                });*/
                rokuItem.seasons = uniqueSeasonNumbers.map(seasonNumber => {
                    const seasonInfo = episodeResponseData.seasons.find(season => season.seasonNumber === seasonNumber);
                    const episodesForSeason = seasonInfo.episodes
                        .filter(episode => episode.seasonNumber === seasonNumber)
                        .map(episode => ({
                            episodeTitle: episode.title,
                            episodeNumber: episode.episodeNumber
                        }));

                    return {
                        season: `season: ${seasonNumber}`,
                        episodes: episodesForSeason
                    };
                });
                rokuItems.push(rokuItem);
            }

        }

        // Write the collected data to a JSON file
        fs.writeFileSync('titles.json', JSON.stringify(rokuItems, null, 2));
        console.log('Data has been extracted and saved to titles.json');
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}

performScraping();
