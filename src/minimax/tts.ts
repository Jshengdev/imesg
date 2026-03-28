import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { config } from "../config";

const AUDIO_DIR = join(process.cwd(), "audio");
const ENDPOINTS = ["/v1/t2a_v2", "/v1/text_to_speech", "/v1/tts"];
const MODEL = "speech-2.8-turbo";

export async function textToSpeech(text: string, emotion = "neutral"): Promise<string> {
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
        }),
      });

      const json = (await res.json()) as any;
      if (json.base_resp?.status_code !== 0) {
        console.warn(`tts ${endpoint} error:`, json.base_resp?.status_msg);
        continue;
      }

      const audioHex: string = json.data?.audio;
      if (!audioHex) { console.warn(`tts ${endpoint}: no audio data`); continue; }

      const filePath = join(AUDIO_DIR, `${randomUUID()}.m4a`);
      writeFileSync(filePath, Buffer.from(audioHex, "hex"));
      return filePath;
    } catch (err) {
      console.warn(`tts ${endpoint} failed:`, err);
    }
  }

  console.error("all tts endpoints failed — returning placeholder");
  const p = join(AUDIO_DIR, `${randomUUID()}.m4a`);
  const SILENT_MP3 = Buffer.from(
    "fff3e004000000000000000000000000000000000000000000000000000000000000000000",
    "hex"
  );
  writeFileSync(p, SILENT_MP3);
  return p;
}
