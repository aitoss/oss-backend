const adminEmail = process.env.ADMINMAIL;
const adminPasswordHash = process.env.ADMINHASH;

const allowedOrigins = [
  "http://localhost:3001",
  "http://localhost:5173",
  "https://anubhav.aitoss.club",
  "https://anubhav-staging.vercel.app/"
];

module.exports = { adminEmail, adminPasswordHash, allowedOrigins }
