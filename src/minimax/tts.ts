import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import config from "../config";

const AUDIO_DIR = join(process.cwd(), "audio");

const API_ENDPOINTS = ["/v1/t2a_v2", "/v1/text_to_speech", "/v1/tts"];

export async function textToSpeech(
  text: string,
  emotion = "neutral"
): Promise<string> {
  mkdirSync(AUDIO_DIR, { recursive: true });

  for (const endpoint of API_ENDPOINTS) {
    try {
      const response = await fetch(config.minimax.api_base + endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.minimax.api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "speech-2.8-turbo",
          text,
          voice_setting: {
            voice_id: "male-qn-qingse",
            emotion,
          },
        }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json.base_resp?.status_code === 0 && json.data?.audio) {
          const audioHex = json.data.audio;
          const audioBuffer = Buffer.from(audioHex, "hex");
          const filePath = join(AUDIO_DIR, `${randomUUID()}.m4a`);
          writeFileSync(filePath, audioBuffer);
          return filePath;
        }
      }
    } catch (error) {
      console.error(`Endpoint ${endpoint} failed:`, error);
    }
  }

  // On total failure, write a silent audio file
  const silentAudioHex = "fff3e004" + "00".repeat(33);
  const silentAudioBuffer = Buffer.from(silentAudioHex, "hex");
  const filePath = join(AUDIO_DIR, `${randomUUID()}.m4a`);
  writeFileSync(filePath, silentAudioBuffer);
  return filePath;
}
