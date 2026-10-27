// Thin client: the Python server holds the Gemini API key and calls Gemini on our behalf.
class GeminiAPIService {
  constructor() {
    this.aiEnabled = false;
    // Remove any key saved by older versions of the app.
    try { localStorage.removeItem("gemini_api_key"); } catch (e) {}
  }

  async loadConfig() {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      this.aiEnabled = !!(res.ok && data.ai_enabled);
    } catch (e) {
      this.aiEnabled = false;
    }
  }

  hasApiKey() {
    return this.aiEnabled;
  }

  async generatePlan(location, duration, budget, style) {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: location, duration, budget, style })
    });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      throw new Error(data.error || "Failed to generate the itinerary.");
    }
    return data.plan;
  }
}

const geminiAPI = new GeminiAPIService();
