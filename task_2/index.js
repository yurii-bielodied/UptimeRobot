const http = require('http');

const version = process.env.VERSION || '2.0.0';

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(`Version: ${version}\n`);
});

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`Listening on port ${port}, version ${version}`);
});
