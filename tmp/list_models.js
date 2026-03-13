
async function listModels() {
  const apiKey = "AIzaSyAwzBCfDm8xycNgOEJXw8Uq7xRdIlBdMmY";
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(JSON.stringify(data.models.map(m => m.name)));
  } catch (e) {
    console.error("Error:", e);
  }
}

listModels();
