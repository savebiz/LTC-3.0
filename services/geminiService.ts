
import { GoogleGenAI } from "@google/genai";
import { RegistrationData } from "../types";
import { EVENT_DETAILS } from "../constants";

export const generatePersonalizedWelcome = async (data: RegistrationData): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      You are the official AI ambassador for the ${EVENT_DETAILS.name} (Theme: ${EVENT_DETAILS.fullTheme}).
      A new teen attendee has registered:
      Name: ${data.fullName}
      Age: ${data.age}
      Interests: ${data.interests.join(', ')}
      Zone/Parish: ${data.zoneParish}

      The event is anchored on Philippians 4:8. 
      Write a short, high-energy welcome message (under 50 words). 
      Emphasize "Leading through learning" and "Thinking on pure and lovely things."
      Make it feel futuristic and spiritually empowering.
      Just the text. No placeholders.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.8,
        topP: 0.95,
      }
    });

    return response.text || `Welcome to C3TC 3.0, ${data.fullName}! Get ready to LEAD: Learn, Engage, Activate, and Develop your potential.`;
  } catch (error) {
    console.error("Gemini Error:", error);
    return `Welcome to ${EVENT_DETAILS.name}! We can't wait to see you at Glory Arena, Redemption City of God.`;
  }
};

export const askAboutVenue = async (query: string): Promise<{text: string, sources: any[]}> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `User asks about the venue (${EVENT_DETAILS.venue} at ${EVENT_DETAILS.address}): ${query}. Help them with directions to Glory Arena, Redemption City of God, Ogun State, Nigeria. It is located along the Lagos-Ibadan Expressway, Mowe, Ogun State.`,
      config: {
        tools: [{googleMaps: {}}],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: EVENT_DETAILS.lat,
              longitude: EVENT_DETAILS.lng
            }
          }
        }
      },
    });

    return {
      text: response.text || "Glory Arena is located inside the Redemption City of God, Ogun State, Nigeria. It's accessible via the Lagos-Ibadan Expressway.",
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Maps Grounding Error:", error);
    return { text: "The venue is Glory Arena, located inside Redemption City of God, Ogun State, Nigeria.", sources: [] };
  }
};
