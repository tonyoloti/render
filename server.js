import express from "express";
import fetch from "node-fetch";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json({ limit: "2mb" }));

app.post("/render", async (req, res) => {
  try {
    const { videoUrl, text } = req.body;
    if (!videoUrl || !text) {
      return res.status(400).json({ error: "videoUrl and text are required" });
    }

    const workdir = "/tmp";
    const inputPath = path.join(workdir, `in_${Date.now()}.mp4`);
    const outputPath = path.join(workdir, `out_${Date.now()}.mp4`);
    const textPath = path.join(workdir, `text_${Date.now()}.txt`);

    // 1) Download video
    const r = await fetch(videoUrl);
    if (!r.ok) {
      return res.status(400).json({ error: `Failed to download video: ${r.status}` });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(inputPath, buf);

    // 2) Force 2-line text (split at last space)
    const twoLines = (() => {
      const t = String(text || "").trim();
      const i = t.lastIndexOf(" ");
      return i > 0 ? t.slice(0, i) + "\n" + t.slice(i + 1) : t;
    })();
    fs.writeFileSync(textPath, twoLines, "utf8");

    // 3) Drawtext without grey box + with line spacing
    const vf = [
      "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
      `textfile=${textPath}`,
      "fontsize=18",
      "fontcolor=white",
      "borderw=2",
      "bordercolor=black",
      "line_spacing=10",
      "x=40",
      "y=(h-text_h)/2"
    ].join(":");

    // 4) Render
    await new Promise((resolve, reject) => {
      execFile(
        "ffmpeg",
        ["-y", "-i", inputPath, "-vf", vf, "-c:a", "copy", outputPath],
        (err, stdout, stderr) => {
          if (err) return reject(new Error(stderr || err.message));
          resolve();
        }
      );
    });

    // 5) Return mp4
    res.setHeader("Content-Type", "video/mp4");
    fs.createReadStream(outputPath).pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 3000);
