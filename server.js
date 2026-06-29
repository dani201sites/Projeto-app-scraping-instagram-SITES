import http from "node:http";
import { handleRequest } from "./lib/app.js";

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

const server = http.createServer(handleRequest);

server.listen(port, host, () => {
  console.log(`LeadScrape rodando em http://${host}:${port}`);
});
