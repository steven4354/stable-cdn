const express = require("express");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const axios = require("axios");
const midjourney = require("midjourney");

// dotenv
require("dotenv").config();

const client = new midjourney.Midjourney({
  ServerId: process.env.SERVER_ID,
  ChannelId: process.env.CHANNEL_ID,
  SalaiToken: process.env.SALAI_TOKEN,
  Debug: true,
  Ws: true,
});

const app = express();

const IMAGE_FOLDER = "./images";

// Ensure the image folder exists
if (!fs.existsSync(IMAGE_FOLDER)) {
  fs.mkdirSync(IMAGE_FOLDER);
}

app.get("/:prompt", async (req, res) => {
  const prompt = req.params.prompt.replace(/-/g, " ");
  console.log("prompt: ", prompt);

  const imagePath = path.join(IMAGE_FOLDER, `${req.params.prompt}.png`);

  console.log("imagePath: ", imagePath);

  // Check if the image already exists
  if (fs.existsSync(imagePath)) {
    res.sendFile(path.resolve(imagePath));
  } else {
    // Generate the image using Replicate API
    const response = await axios.post(
      "https://api.replicate.com/v1/predictions",
      {
        version:
          "db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
        input: {
          prompt: prompt,
        },
      },
      {
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const predictionId = response.data.id;

    // Poll the API for the prediction result
    let predictionResult;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      predictionResult = await axios.get(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );
    } while (predictionResult.data.status !== "succeeded");

    const imageUrl = predictionResult.data.output[0];

    // Download the generated image
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    // Save the downloaded image to the local folder
    await fs.promises.writeFile(imagePath, imageResponse.data);

    // Send the generated image
    res.sendFile(path.resolve(imagePath));
  }
});

app.get("/unsplash/:search", async (req, res) => {
  const searchQuery = req.params.search.replace(/-/g, " ");
  console.log("searchQuery: ", searchQuery);

  try {
    const response = await axios.get(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
        searchQuery
      )}&client_id=${process.env.UNSPLASH_API_KEY}&per_page=1`
    );

    if (response.data.results.length > 0) {
      const imageUrl = response.data.results[0].urls.regular;
      res.redirect(imageUrl);
    } else {
      res.status(404).send("No image found for the given search query.");
    }
  } catch (error) {
    console.error("Error fetching image from Unsplash:", error);
    res.status(500).send("Error fetching image from Unsplash.");
  }
});

app.get("/midjourney/:prompt", async (req, res) => {
  console.log("req.params: ", req.params);

  const prompt = req.params.prompt.replace(/-/g, " ");
  console.log("prompt: ", prompt);

  const msg = await client.Imagine("A little pink elephant");

  console.log({ msg });

  // Redirect the user to the msg.uri
  res.redirect(msg.uri);
});

const PORT = process.env.PORT || 5683;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
