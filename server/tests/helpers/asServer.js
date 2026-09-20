import http from 'node:http';
/**
Express 5's app function requires (req, res, next).
Node's http.Server calls request listeners with only (req, res).
Supertest passes the app straight to http.createServer, so Express 5 throws "argument callback is required". This wrapper injects a next.
*/
export default function asServer(app) {
  return http.createServer((req, res) => {
    app(req, res, (err) => {
      if (err) {
        res.statusCode = err.statusCode || 500;
        res.end();
      } else if (!res.headersSent) {
        res.statusCode = 404;
        res.end();
      }
    });
  });
}