const supertokens = require("supertokens-node");
const EmailPassword = require("supertokens-node/recipe/emailpassword");
const Session = require("supertokens-node/recipe/session");
const User = require("./models/User");

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
    EmailPassword.init({
      override: {
        functions: (originalImpl) => ({
          ...originalImpl,
          signUp: async (input) => {
            const response = await originalImpl.signUp(input);
            if (response.status === "OK") {
              try {
                const stUser = response.user;
                const email = (stUser.emails && stUser.emails[0]) || input.email;
                const now = new Date();
                // Link orphan if email exists with no supertokensUserId; else create.
                await User.findOneAndUpdate(
                  { email: email.toLowerCase() },
                  {
                    $set: { supertokensUserId: stUser.id, lastLoggedInAt: now },
                    $setOnInsert: { email: email.toLowerCase(), status: 'active' },
                  },
                  { upsert: true, new: true, setDefaultsOnInsert: true },
                );
              } catch (err) {
                console.error("[SuperTokens.signUp override] failed to upsert local User:", err);
              }
            }
            return response;
          },
          signIn: async (input) => {
            const response = await originalImpl.signIn(input);
            if (response.status === "OK") {
              try {
                const stUser = response.user;
                const email = (stUser.emails && stUser.emails[0]) || input.email;
                const now = new Date();
                // Try by supertokensUserId first; if not found, link by email (legacy/orphan).
                const updated = await User.findOneAndUpdate(
                  { supertokensUserId: stUser.id },
                  { $set: { lastLoggedInAt: now } },
                  { new: true },
                );
                if (!updated) {
                  await User.findOneAndUpdate(
                    { email: email.toLowerCase() },
                    {
                      $set: { supertokensUserId: stUser.id, lastLoggedInAt: now },
                      $setOnInsert: { email: email.toLowerCase(), status: 'active' },
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true },
                  );
                }
              } catch (err) {
                console.error("[SuperTokens.signIn override] failed to update local User:", err);
              }
            }
            return response;
          },
        }),
      },
    }),
    Session.init(),
  ],
});

console.log("✅ SuperTokens initialized successfully");
