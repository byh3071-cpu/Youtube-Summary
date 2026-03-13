
const { GoogleGenAI } = require("@google/genai");

async function testGemini() {
  const apiKey = "AIzaSyAwzBCfDm8xycNgOEJXw8Uq7xRdIlBdMmY";
  const ai = new GoogleGenAI({ apiKey }); 
  
  try {
    console.log(`Testing model: models/gemini-pro-latest...`);
    const response = await ai.models.generateContent({
      model: "models/gemini-pro-latest",
      contents: [{ role: "user", parts: [{ text: "Hello, confirm you are working." }] }],
    });
    console.log(`Success!`);
    console.log("Text:", response.text); 
    return;
  } catch (e) {
    console.error(`Failed:`, e.status || e.code || e.message, e);
  }
}

testGemini();
