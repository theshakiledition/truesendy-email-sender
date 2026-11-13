/**
 * src/server.js
 * HTTP Server Entrypoint
 */

const app = require('./app');

const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Truesendy API] Server listening on port ${PORT}`);
});
