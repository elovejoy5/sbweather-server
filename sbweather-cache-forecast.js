const https = require("node:https");
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const client = new S3Client();

// Add file type constants at the top level
const FileType = {
  WEATHER_FORECAST: "weatherForecast",
  TIDE_PREDICTION: "tidePrediction",
};

const handler = async () => {
  try {
    // Step 1: Get weather forecast
    const { status, data } = await getWeatherForecast();
    if (status === 200 && data) {
      console.log("getForecast was successful, creating cache file now");
      await createS3File(data, FileType.WEATHER_FORECAST);
    }

    // Step 2: Get tide predictions after successful forecast, if needed
    const tidesAlreadyCached = await checkIfTidesAreCached();
    if (!tidesAlreadyCached) {
      const { status: tideStatus, data: tideData } = await getTidePredictions();
      if (tideStatus === 200 && tideData) {
        await createS3File(tideData, FileType.TIDE_PREDICTION);
      }
    } else {
      console.log(
        "Skipping tide prediction fetch - cache exists for current month"
      );
    }
  } catch (error) {
    console.error("Error during execution:", error);
    throw error;
  }
};

module.exports = {
  handler,
};

const createS3File = async (data, fileType = FileType.WEATHER_FORECAST) => {
  const Bucket = "sbweather-s3-bucket";
  const today = new Date();

  let Key;
  if (fileType === FileType.TIDE_PREDICTION) {
    // YYYY-MM-tides.json, e.g. 2025-02-tides.json
    Key = today.toISOString().substring(0, 7) + "-tides.json";
  } else {
    // YYYY-MM-DD.json format for weather forecasts
    Key = today.toISOString().substring(0, 10) + ".json";
  }

  const Body = JSON.stringify(data);
  const ACL = "public-read";

  const input = { Body, Bucket, Key, ACL };
  const command = new PutObjectCommand(input);
  const response = await client.send(command);
  if (
    response &&
    response["$metadata"] &&
    response["$metadata"].httpStatusCode === 200
  ) {
    console.log(`File ${Key} created in S3:${Bucket}`);
  } else {
    console.log("response: ", JSON.stringify(response, null, 2));
    throw new Error("Failed to create file in S3");
  }
};

const getTidePredictions = async () => {
  const today = new Date();

  // Set to first day of current month
  const begin = new Date(today.getFullYear(), today.getMonth(), 1);
  const begin_date = begin.toISOString().substring(0, 10).replace(/-/g, "");

  // Set to last day of month after next
  const end = new Date(today.getFullYear(), today.getMonth() + 3, 0);
  const end_date = end.toISOString().substring(0, 10).replace(/-/g, "");

  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${begin_date}&end_date=${end_date}&station=9411340&product=predictions&datum=MLLW&time_zone=lst_ldt&interval=hilo&units=english&application=DataAPI_Sample&format=json`;

  const getPromise = new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let s = "";
        res.on("data", (d) => (s += d));
        res.on("end", (_) => {
          let data = "";
          try {
            data = JSON.parse(s);
          } catch (e) {
            data = "JSON.parse() on buffer failed";
          }
          console.log(`Retreived tide data from ${begin_date} to ${end_date}`);
          resolve({ status: res?.statusCode, data });
        });
      })
      .on("error", (e) => {
        resolve({ status: 500, data: null });
      });
  });
  return getPromise;
};

const getWeatherForecast = async () => {
  const url = "https://api.weather.gov/gridpoints/LOX/103,70/forecast"; // santa barbara

  // API docs ask for User-Agent to be as unique as possible:
  // https://www.weather.gov/documentation/services-web-api
  // Their example is "User-Agent: (myweatherapp.com, contact@myweatherapp.com)"
  const options = {
    headers: {
      "User-Agent": "(elovejoy5.github.io/sbweather/, elijah_AT_lovejoy.com)",
    },
  };

  const getPromise = new Promise((resolve, re) => {
    //https://nodejs.org/docs/latest-v18.x/api/https.html#httpsgeturl-options-callback
    https
      .get(url, options, (res) => {
        // console.log("statusCode:", res?.statusCode);
        // console.log("headers:", res?.headers);

        let s = "";
        res.on("data", (d) => (s += d));
        res.on("end", (_) => {
          let data = "";
          try {
            data = JSON.parse(s);
          } catch (e) {
            data = "JSON.parse() on buffer failed";
          }
          resolve({ status: res?.statusCode, data });
        });
      })
      .on("error", (e) => {
        // console.error(e);
        // return { status: 500, data: null };
        resolve({ status: 500, data: null });
      });
  });
  return getPromise;
};

const checkIfTidesAreCached = async () => {
  const Bucket = "sbweather-s3-bucket";
  const today = new Date();
  const Key = today.toISOString().substring(0, 7) + "-tides.json";

  try {
    const command = new HeadObjectCommand({
      Bucket,
      Key,
    });

    const response = await client.send(command);
    if (response && response["$metadata"].httpStatusCode === 200) {
      console.log(`Tide cache exists for ${Key}`);
      return true;
    }
  } catch (error) {
    if (error.name === "NotFound") {
      console.log(`No tide cache found for ${Key}`);
      return false;
    }
    console.error("Error checking tide cache:", error);
    throw error;
  }

  return false;
};
