// Netlify serverless function — validates login password
// Set the environment variable RNB_APP_PASSWORD in your Netlify dashboard
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { password } = JSON.parse(event.body);
    const correctPassword = process.env.RNB_APP_PASSWORD || "rnb2026";

    if (password === correctPassword) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, token: "rnb-auth-" + Date.now() }),
      };
    } else {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: "Invalid password" }),
      };
    }
  } catch (err) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Bad request" }),
    };
  }
};
