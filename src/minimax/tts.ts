import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { config } from "../config";

const AUDIO_DIR = join(process.cwd(), "audio");
const ENDPOINTS = ["/v1/t2a_v2", "/v1/text_to_speech", "/v1/tts"];
const MODEL = "speech-2.8-turbo";

export async function textToSpeech(text: string, emotion = "neutral"): Promise<string | null> {
  mkdirSync(AUDIO_DIR, { recursive: true });

  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(`${config.MINIMAX_API_HOST}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.MINIMAX_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          text,
          voice_setting: { voice_id: "male-qn-qingse", emotion },
          audio_setting: { format: "mp3" },
        }),
      });

      const json = (await res.json()) as any;
      if (json.base_resp?.status_code !== 0) {
        console.warn(`tts ${endpoint} error:`, json.base_resp?.status_msg);
        continue;
      }

      const audioHex: string = json.data?.audio;
      if (!audioHex) { console.warn(`tts ${endpoint}: no audio data`); continue; }

      const filePath = join(AUDIO_DIR, `nudge-voice-${randomUUID().slice(0, 8)}.mp3`);
      writeFileSync(filePath, Buffer.from(audioHex, "hex"));
      console.log(`[tts] generated ${filePath} (${Buffer.from(audioHex, "hex").length} bytes)`);
      return filePath;
    } catch (err) {
      console.warn(`tts ${endpoint} failed:`, err);
    }
  }

  console.error("[tts] all endpoints failed — skipping audio");
  return null;
}
