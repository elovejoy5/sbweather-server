const { handler } = require("./sbweather-cache-forecast");

async function runLocal() {
  try {
    console.log("Starting local execution...");
    await handler();
    console.log("Execution completed");
  } catch (error) {
    console.error("Error during execution:", error);
  }
}

runLocal();
