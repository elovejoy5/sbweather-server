const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const client = new S3Client();

const handler = async () => {
  const timestamp = new Date().toISOString();
  console.log(`sbweather-cache-forecast called at ${timestamp}`);
  await createS3File(timestamp + ".json");
  return "Hello World";
};

module.exports = {
  handler,
};

const createS3File = async (Key) => {
  // see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/PutObjectCommand/
  const Bucket = "sbweather-s3-bucket";
  const Body = JSON.stringify('{"foo":"bar"}');
  const ACL = "public-read";

  const input = { Body, Bucket, Key, ACL };
  const command = new PutObjectCommand(input);
  const response = await client.send(command);
  console.log(response);
};
