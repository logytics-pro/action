const https = require("https");
const http = require("http");

async function sendToApi(apiUrl, apiKey, payload, openaiKey) {
  const url = new URL("/api/failures", apiUrl);
  const isHttps = url.protocol === "https:";
  const client = isHttps ? https : http;

  const headers = {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  };

  if (openaiKey) {
    headers["X-OpenAI-Key"] = openaiKey;
  }

  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: "POST",
        headers: {
          ...headers,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(new Error(parsed.error || `API returned ${res.statusCode}`));
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(new Error(`Failed to parse API response: ${data}`));
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("API request timeout"));
    });

    req.write(body);
    req.end();
  });
}

module.exports = { sendToApi };
