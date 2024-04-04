const https = require("node:https");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const client = new S3Client();

const handler = async () => {
  const { status, data } = await getForecast();
  // console.log(`status from getForecast was ${status} `);
  // console.log(data);
  if (status === 200 && data) {
    console.log("getForecast was successful, creating cache file now");
    await createS3File(data);
  }
  // return "Hello World";
};

module.exports = {
  handler,
};

const createS3File = async (data) => {
  const Bucket = "sbweather-s3-bucket";
  const Key = new Date().toISOString().substring(0, 10) + ".json";
  console.log(`sbweather-cache-forecast trying to create ${Key} in ${Bucket}`);

  // see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/PutObjectCommand/
  const Body = JSON.stringify(data);
  const ACL = "public-read";

  const input = { Body, Bucket, Key, ACL };
  const command = new PutObjectCommand(input);
  const response = await client.send(command);
  // console.log(response);
};

const getForecast = async () => {
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
