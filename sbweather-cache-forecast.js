const https = require("node:https");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const client = new S3Client();

const handler = async () => {
  // Step 1: Get weather forecast
  const { status, data } = await getWeatherForecast();
  if (status === 200 && data) {
    console.log("getForecast was successful, creating cache file now");
    await createS3File(data);
  }

  // Step 2: Get tide predictions after successful forecast
  const { status: tideStatus, data: tideData } = await getTidePredictions();
  if (tideStatus === 200 && tideData) {
    console.log("getTidePredictions was successful, creating tide cache file");
    await createS3File(tideData, "tides-");
  }
};

module.exports = {
  handler,
};

const createS3File = async (data, prefix = "") => {
  const Bucket = "sbweather-s3-bucket";
  const Key = prefix + new Date().toISOString().substring(0, 10) + ".json";
  console.log(`sbweather-cache-forecast trying to create ${Key} in ${Bucket}`);

  // see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/PutObjectCommand/
  const Body = JSON.stringify(data);
  const ACL = "public-read";

  const input = { Body, Bucket, Key, ACL };
  const command = new PutObjectCommand(input);
  const response = await client.send(command);
  // console.log(response);
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
