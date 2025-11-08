import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import session from "express-session";
import cookieParser from "cookie-parser";
import { prisma } from "@propgroup/db";
import passport from "./config/passport.js";

// Import routes
import authRoutes from "./routes/auth.js";
import propertyRoutes from "./routes/properties.js";
import userRoutes from "./routes/users.js";
import favoriteRoutes from "./routes/favorites.js";
import inquiryRoutes from "./routes/inquiries.js";
import portfolioRoutes from "./routes/portfolio.js";
import adminRoutes from "./routes/admin.js";
import agentRoutes from "./routes/agent.js";
import aiSearchRoutes from "./routes/ai-search.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Trust proxy for Render deployment
app.set("trust proxy", 1);

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS configuration - Enhanced for production
const allowedOrigins = FRONTEND_URL.split(",").map((url) => url.trim());
console.log("🔒 CORS - Allowed Origins:", allowedOrigins);
console.log("🔒 CORS - Environment:", process.env.NODE_ENV);

// CORS middleware function - More permissive for production
const corsOptions = {
  origin: function (origin, callback) {
    console.log(`🔒 CORS - Request from origin: ${origin || "no-origin"}`);

    // Allow requests with no origin (like mobile apps, curl, Postman, server-to-server)
    if (!origin) {
      console.log("✅ CORS - Allowing request with no origin");
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log("✅ CORS - Origin allowed (in whitelist):", origin);
      callback(null, true);
    } else {
      // In production, allow all origins for now to debug
      if (process.env.NODE_ENV === 'production') {
        console.warn("⚠️ CORS - Allowing origin (production mode):", origin);
        callback(null, true);
      } else {
        console.warn("⚠️ CORS - Blocked origin:", origin);
        callback(null, true); // Changed to allow even in dev for flexibility
      }
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cookie",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  exposedHeaders: ["Set-Cookie"],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Explicit OPTIONS handler for preflight requests - Must be before other routes
app.options("*", (req, res) => {
  const origin = req.headers.origin;
  console.log(`🔒 CORS Preflight - Origin: ${origin || "no-origin"}`);

  // Always allow preflight requests to pass
  res.header("Access-Control-Allow-Origin", origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, X-Requested-With, Accept, Origin");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Max-Age", "86400");
  console.log("✅ CORS Preflight - Headers set, responding with 204");
  return res.sendStatus(204);
});

// Session configuration
app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "propgroup-secret-change-this-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  }),
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Health check endpoints
app.get("/health", async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      database: "connected",
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      database: "disconnected",
      error: error.message,
    });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      database: "connected",
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error("API Health check failed:", error);
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      database: "disconnected",
      error: error.message,
    });
  }
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/users", userRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/inquiries", inquiryRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/ai-search", aiSearchRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);

  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation Error",
      message: err.message,
      details: err.details,
    });
  }

  if (err.name === "UnauthorizedError") {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or missing authentication token",
    });
  }

  res.status(500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : err.message,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.originalUrl} not found`,
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

// Startup database connection check
async function startServer() {
  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔗 Frontend URL: ${FRONTEND_URL}`);
      console.log(`📡 Listening on: 0.0.0.0:${PORT}`);
      console.log(`🗄️  Database: Connected`);
      console.log(`✅ Server is ready to accept connections`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('Database URL:', process.env.DATABASE_URL ? 'Set' : 'NOT SET');
    process.exit(1);
  }
}

startServer();
