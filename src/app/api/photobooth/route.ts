// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { NextRequest, NextResponse } from "next/server";

const COMFYUI_API_URL = process.env.COMFYUI_API_URL || "http://127.0.0.1:8188";

// All available style names
const ALL_STYLES = [
  "anime",
  "van-gogh",
  "monet",
  "picasso",
  "watercolor",
  "sketch",
  "cyberpunk",
  "pixel-art",
  "oil-painting",
] as const;

type StyleName = (typeof ALL_STYLES)[number];

// Style presets with prompts and denoise settings
const STYLE_PROMPTS: Record<
  StyleName,
  { prompt: string; negative: string; denoise: number }
> = {
  anime: {
    prompt:
      "transform into anime style, beautiful anime artwork, cel shading, large expressive anime eyes, clean lineart, vibrant colors, manga aesthetic, preserve original face and facial features",
    negative:
      "blurry, low quality, photorealistic, realistic anatomy, distorted proportions, bad hands, deformed face, ugly, change face into different person, wrong face, extra faces, mutated face, asymmetric face, bad eyes, wrong eyes",
    denoise: 0.675,
  },
  "van-gogh": {
    prompt:
      "transform into Van Gogh post-impressionist style, swirling brushstrokes, bold colors, swirling patterns, impasto technique, expressive brushwork, preserve original face and subject",
    negative:
      "blurry, low quality, photorealistic, photograph, flat colors, deformed face, ugly face, change face into different person, wrong face, extra faces, mutated features, asymmetric",
    denoise: 0.75,
  },
  monet: {
    prompt:
      "transform into Monet impressionist style, soft dreamy brushwork, beautiful light and color interactions, atmospheric haze, preserve original face and subject",
    negative:
      "blurry, low quality, photorealistic, photograph, sharp edges, deformed face, ugly, change face into different person, wrong face, extra faces, mutated features",
    denoise: 0.75,
  },
  picasso: {
    prompt:
      "transform into Picasso cubist style, bold geometric shapes, fragmented forms, strong colors, modernist art, avant-garde composition, preserve original face and subject",
    negative:
      "blurry, low quality, photorealistic, photograph, realistic proportions, deformed face, ugly, change face into different person, wrong face, extra faces, mutated features, asymmetric",
    denoise: 0.75,
  },
  watercolor: {
    prompt:
      "transform into watercolor painting style, soft flowing edges, beautiful bleeding colors, paper texture, delicate brushstrokes, luminous washes, preserve original face and subject",
    negative:
      "blurry, low quality, photorealistic, photograph, sharp lines, digital look, deformed face, ugly, change face into different person, wrong face, extra faces",
    denoise: 0.75,
  },
  sketch: {
    prompt:
      "transform into pencil sketch style, hand-drawn artistic drawing, detailed linework, professional cross-hatching, graphite texture, black and white illustration, preserve original face and subject",
    negative:
      "blurry, low quality, photorealistic, photograph, color, shading, deformed face, ugly, change face into different person, wrong face, extra faces",
    denoise: 0.75,
  },
  cyberpunk: {
    prompt:
      "transform into cyberpunk style, neon lights, futuristic holographic elements, dark moody atmosphere, glowing neon accents, tech-noir aesthetic, preserve original face and subject",
    negative:
      "blurry, low quality, natural, soft lighting, pastel colors, deformed face, ugly, change face into different person, wrong face, extra faces, mutated features",
    denoise: 0.75,
  },
  "pixel-art": {
    prompt:
      "transform into pixel art style, 8-bit retro aesthetic, chunky pixels, limited color palette, nostalgic retro gaming look, preserve original face and subject",
    negative:
      "blurry, low quality, photorealistic, smooth gradients, modern graphics, deformed face, ugly, change face into different person, wrong face, extra faces",
    denoise: 0.75,
  },
  "oil-painting": {
    prompt:
      "transform into oil painting style, rich textures, thick expressive brushstrokes, classical artwork, museum quality, dramatic lighting, preserve original face and subject",
    negative:
      "blurry, low quality, photorealistic, photograph, digital look, deformed face, ugly, change face into different person, wrong face, extra faces, mutated features",
    denoise: 0.75,
  },
};

function buildWorkflow(
  imageName: string,
  style: StyleName,
  options: {
    denoise?: number;
    steps?: number;
    seed?: number;
  }
) {
  const preset = STYLE_PROMPTS[style];
  const finalDenoise = options.denoise ?? preset.denoise;
  const steps = options.steps ?? 25;
  const seed = options.seed ?? 42;

  return {
    "3": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: "sd_xl_base_1.0.safetensors" },
    },
    "4": {
      class_type: "CLIPTextEncode",
      inputs: { text: preset.prompt, clip: ["3", 1] },
    },
    "5": {
      class_type: "CLIPTextEncode",
      inputs: { text: preset.negative, clip: ["3", 1] },
    },
    "6": {
      class_type: "LoadImage",
      inputs: { image: imageName },
    },
    "7": {
      class_type: "VAEEncode",
      inputs: { pixels: ["6", 0], vae: ["3", 2] },
    },
    "8": {
      class_type: "KSampler",
      inputs: {
        model: ["3", 0],
        seed,
        steps,
        cfg: 7.5,
        sampler_name: "euler",
        scheduler: "normal",
        positive: ["4", 0],
        negative: ["5", 0],
        latent_image: ["7", 0],
        denoise: finalDenoise,
      },
    },
    "9": {
      class_type: "VAEDecode",
      inputs: { samples: ["8", 0], vae: ["3", 2] },
    },
    "10": {
      class_type: "SaveImage",
      inputs: { filename_prefix: `style_${style}_`, images: ["9", 0] },
    },
  };
}

// Check ComfyUI health
export async function GET() {
  try {
    const res = await fetch(`${COMFYUI_API_URL}/system_stats`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { status: "error", message: "ComfyUI returned non-200" },
        { status: 502 }
      );
    }
    const data = await res.json();
    return NextResponse.json({ status: "ok", comfyui: data });
  } catch {
    return NextResponse.json(
      { status: "offline", message: "ComfyUI is not reachable" },
      { status: 503 }
    );
  }
}

// Upload image and queue style generation jobs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      imageBase64,
      imageName,
      styles,
      denoise,
      steps,
      seed,
    } = body as {
      imageBase64?: string;
      imageName?: string;
      styles?: string[];
      denoise?: number;
      steps?: number;
      seed?: number;
    };

    if (!imageBase64 && !imageName) {
      return NextResponse.json(
        { error: "imageBase64 or imageName is required" },
        { status: 400 }
      );
    }

    // Validate styles
    const requestedStyles = styles?.length
      ? styles.filter((s): s is StyleName => ALL_STYLES.includes(s as StyleName))
      : [...ALL_STYLES];

    if (requestedStyles.length === 0) {
      return NextResponse.json(
        { error: "No valid styles specified" },
        { status: 400 }
      );
    }

    // Upload image to ComfyUI if base64 provided
    let finalImageName = imageName ?? "capture.png";

    if (imageBase64) {
      // Strip data URL prefix if present
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, "base64");

      // ComfyUI's /upload/image endpoint expects multipart/form-data
      // Build it manually to avoid Blob/FormData issues in Node.js
      const boundary = `----PhotoBoothBoundary${Date.now()}`;
      const filename = finalImageName;

      const preamble = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="image"; filename="${filename}"\r\n` +
        `Content-Type: image/png\r\n\r\n`
      );
      const postamble = Buffer.from(
        `\r\n--${boundary}\r\n` +
        `Content-Disposition: form-data; name="overwrite"\r\n\r\n` +
        `true\r\n` +
        `--${boundary}--\r\n`
      );

      const fullBody = Buffer.concat([preamble, imageBuffer, postamble]);

      const uploadRes = await fetch(`${COMFYUI_API_URL}/upload/image`, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: fullBody,
        signal: AbortSignal.timeout(30000), // 30s for image upload
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error("ComfyUI upload failed:", uploadRes.status, errText);
        return NextResponse.json(
          { error: "Failed to upload image to ComfyUI", details: errText },
          { status: 502 }
        );
      }

      const uploadData = await uploadRes.json();
      finalImageName = uploadData.name ?? finalImageName;
    }

    // Queue generation for each style
    const jobs: {
      style: string;
      promptId: string;
    }[] = [];

    for (const style of requestedStyles) {
      const workflow = buildWorkflow(finalImageName, style, {
        denoise,
        steps,
        seed,
      });

      const promptRes = await fetch(`${COMFYUI_API_URL}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflow }),
      });

      if (!promptRes.ok) {
        const errText = await promptRes.text();
        console.error(`Failed to queue ${style}:`, errText);
        continue;
      }

      const promptData = await promptRes.json();
      jobs.push({
        style,
        promptId: promptData.prompt_id,
      });
    }

    return NextResponse.json({
      status: "queued",
      jobs,
      totalStyles: requestedStyles.length,
    });
  } catch (error) {
    console.error("Photo booth error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}