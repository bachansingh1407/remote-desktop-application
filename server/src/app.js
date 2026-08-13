const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const morgan = require("morgan");

const env = require("./config/env");
const logger = require("./config/logger");
const routes = require("./routes");
const { globalLimiter } = require("./middlewares/rateLimiters");
const notFoundMiddleware = require("./middlewares/notFound.middleware");
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();

// Trust the first proxy hop (needed for correct req.ip behind
// Nginx/Render/Railway/etc. — matters for rate limiting and audit logs).
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // allow file downloads to be embedded/opened cross-origin
  })
);

app.use(
  cors({
    // Reflects the request's Origin back only if it's in the allow-list,
    // instead of a single hardcoded string — lets localhost (dev) and a
    // deployed frontend both work against this same backend/env.
    origin: (origin, callback) => {
      // No Origin header at all (curl, server-to-server, same-origin) — allow.
      if (!origin) return callback(null, true);
      if (env.corsOrigins.includes(origin)) return callback(null, true);
      logger.warn(`CORS blocked request from origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true, // required so the refresh-token cookie is sent/received
  })
);

app.use(compression());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(cookieParser());

if (!env.isProd) {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      stream: { write: (msg) => logger.info(msg.trim()) },
    })
  );
}

app.use(globalLimiter);

app.use(env.apiPrefix, routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;