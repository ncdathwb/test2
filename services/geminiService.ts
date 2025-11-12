
import { GoogleGenAI, Modality } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateSpeech(text: string, voice: string): Promise<string | undefined> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice },
                    },
                },
            },
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio;
    } catch (error) {
        console.error("Error generating speech:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to communicate with Gemini API: ${error.message}`);
        }
        throw new Error("An unknown error occurred while generating speech.");
    }
}

export async function generateLyrics(prompt: string): Promise<string> {
    try {
        const fullPrompt = `Với vai trò là một nhạc sĩ tài hoa, hãy sáng tác lời bài hát nhẹ nhàng, sâu lắng bằng tiếng Việt dựa trên chủ đề sau: "${prompt}". Chỉ trả về phần lời bài hát, không thêm bất kỳ giải thích nào khác.`;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: fullPrompt,
        });

        return response.text;
    } catch (error) {
        console.error("Error generating lyrics:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to communicate with Gemini API: ${error.message}`);
        }
        throw new Error("An unknown error occurred while generating lyrics.");
    }
}
