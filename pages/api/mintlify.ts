import { NextApiRequest, NextApiResponse } from "next";
import { gzipSync, gunzipSync, strToU8, strFromU8 } from "fflate";

const allowCors =
  (fn: any) => async (req: NextApiRequest, res: NextApiResponse) => {
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,OPTIONS,PATCH,DELETE,POST,PUT"
    );
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }
    return await fn(req, res);
  };

// return request body with modified api key, when possible
function overwriteApiKey(request: NextApiRequest, newApiKey: string): any {
  /**
   * PostHog js library sends data in the following formats:
   * 1. payload is base64 encoded in the data field with application/x-www-form-urlencoded
   * 2. content is gzip-js compressed in text/plain
   *
   *
   * In scenario 2, the URL query param includes compression=gzip-js
   */
  if (request.query.compression == "gzip-js") {
    // use gzip-js to decompress the payload
    const unzipped = gunzipSync(strToU8(request.body));

    const jsonPayload = strFromU8(unzipped);

    const obj = JSON.parse(jsonPayload);

    obj.token = newApiKey;

    return strFromU8(gzipSync(strToU8(JSON.stringify(obj))));
  } else if (
    request.headers["content-type"] == "application/x-www-form-urlencoded"
  ) {
    // attempt to decode with base64
    const searchParams = new URLSearchParams(request.body);
    if (searchParams.has("data")) {
      const jsonPayload = Buffer.from(
        searchParams.get("data")!,
        "base64"
      ).toString("utf8");

      const obj = JSON.parse(jsonPayload);

      obj.token = newApiKey;

      const newData = Buffer.from(JSON.stringify(obj)).toString("base64");

      return new URLSearchParams({ data: newData }).toString();
    }
  }

  return request.body;
}

async function handler(request: NextApiRequest, response: NextApiResponse) {
  const headers: any = {};

  let key = undefined;

  for (const val of request.rawHeaders) {
    if (key === undefined) {
      key = val;
    } else {
      headers[key] = val;
      key = undefined;
    }
  }
  delete headers["content-length"];

  headers.host = "app.posthog.com";

  if (request.method == "GET") {
    console.log("GET request");
    const resp = await fetch("https://app.posthog.com" + request.url, {
      method: request.method,
      headers: headers,
    });
    response.status(resp.status).send(await resp.text());
    return;
  }

  if (request.headers["content-type"] == "application/x-www-form-urlencoded") {
    request.body = new URLSearchParams(request.body).toString();
  }

  // send request to posthog
  const resp = await fetch("https://app.posthog.com" + request.url, {
    method: request.method,
    headers: headers,
    body: request.body, // keep it unchanged
  });
  console.log("POSTHOG POST request", resp.status);

  headers.host = "ph.usecyclone.dev";

  // send a copy to cyclone
  const resp2 = await fetch("https://ph.usecyclone.dev" + request.url, {
    method: request.method,
    headers: headers,
    body: overwriteApiKey(request, process.env.MINTLIFY_API_KEY!),
  });
  console.log("CYCLONE POST request", resp2.status);

  response.status(resp.status).send(resp.body);
}

export default allowCors(handler);
