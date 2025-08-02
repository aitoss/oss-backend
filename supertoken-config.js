const supertokens = require("supertokens-node");
const EmailPassword = require("supertokens-node/recipe/emailpassword");
const Session = require("supertokens-node/recipe/session");

// Check for required environment variables
if (!process.env.SUPERTOKENS_CONNECTION_URI) {
  console.error("❌ SUPERTOKENS_CONNECTION_URI environment variable is required");
  console.error("Please set it in your .env file");
  process.exit(1);
}

if (!process.env.SUPERTOKENS_API_KEY) {
  console.error("❌ SUPERTOKENS_API_KEY environment variable is required");
  console.error("Please set it in your .env file");
  process.exit(1);
}

supertokens.init({
  framework: "express",
  supertokens: {
    connectionURI: process.env.SUPERTOKENS_CONNECTION_URI,
    apiKey: process.env.SUPERTOKENS_API_KEY,
  },
  appInfo: {
    appName: "Anubhav App",
    apiDomain: process.env.API_DOMAIN || "http://localhost:3000",
    websiteDomain: process.env.WEBSITE_DOMAIN || "http://localhost:5173",
    apiBasePath: "/auth",
    websiteBasePath: "/auth",
  },
  recipeList: [
    EmailPassword.init(),
    Session.init(),
  ],
});

console.log("✅ SuperTokens initialized successfully");
