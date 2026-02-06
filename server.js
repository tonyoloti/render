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

    const r = await fetch(videoUrl);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(inputPath, buf);

    fs.writeFileSync(textPath, text, "utf8");

const vf = [
  "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  `textfile=${textPath}`,
  "fontsize=64",
  "fontcolor=white",
  "borderw=6",
  "bordercolor=black",
  "box=1",
  "boxcolor=black@0.35",
  "boxborderw=20",
  "x=(w-text_w)/2",
  "y=h-(text_h*2)"
].join(":");

    await new Promise((resolve, reject) => {
      execFile("ffmpeg", ["-y", "-i", inputPath, "-vf", vf, "-c:a", "copy", outputPath],
        (err) => err ? reject(err) : resolve()
      );
    });

    res.setHeader("Content-Type", "video/mp4");
    fs.createReadStream(outputPath).pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 3000);
