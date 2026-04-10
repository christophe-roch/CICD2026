const http = require('http');

const PORT = process.env.PORT || 3000;
const ENV = process.env.APP_ENV || 'dev';

const messages = {
  dev: "Hello de l'environnement de DEV",
  qa: "Hello de l'environnement de QA",
  prod: "Hello de l'environnement de PROD",
};

const message = messages[ENV] || "Bonjour de l'environnement de DEV";

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(message + '\n');
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} – ${message}`);
});
