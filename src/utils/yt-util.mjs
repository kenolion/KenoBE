import { writeFile, existsSync, createWriteStream, mkdirSync, unlinkSync } from "fs";
import { exec } from "child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import vm from "node:vm";
import { Masterchat } from "@kenolion/masterchat";
import youtubedl from "youtube-dl-exec";
import { extractWordHeatMap } from "../utils/data-prc-util.mjs";
import { VID_STATS_NM, VID_MSG_NM } from "../constants/app-const.mjs";
import { Innertube, Utils } from "youtubei.js";
import { OUT_PATH } from "../constants/app-const.mjs";
import { MAX_SEGMENT_SECONDS, httpError, parseTimestamp } from "./clip-time-util.mjs";

// Provide a Node.js vm-based JavaScript evaluator so youtubei.js can
// decipher YouTube streaming URLs (required since v16+).
Utils.Platform.shim.eval = async (data, _env) => {
  // data.output is a self-contained script that calls process(n, sp, sig)
  // at the end and returns { sig, n }.  Browser-specific APIs referenced in
  // the player code are never actually invoked during deciphering, so a
  // Proxy-based stub is sufficient to silence ReferenceErrors.
  const stub = new Proxy(
    function () { return stub; },
    {
      get: (_, k) => k === Symbol.toPrimitive ? undefined : stub,
      apply: () => stub,
      construct: () => stub,
    }
  );
  const ctx = vm.createContext({
    globalThis: stub,
    window: stub, self: stub, document: stub,
    navigator: stub, location: stub,
    IDBKeyRange: stub, crypto: stub,
    setTimeout: () => 0, clearTimeout: () => {},
    performance: stub, console,
  });
  return vm.runInContext(`(function(){\n${data.output}\n})()`, ctx, { timeout: 5000 });
};

const yt = await Innertube.create();
// async funtion that intializes masterchat and listens to youtube chat
async function listenYt(videoId, channelId, res, redisService) {
  // let mc = await Masterchat.init(videoId);
  let mc = channelId
    ? new Masterchat(videoId, channelId, { mode: "replay" })
    : await Masterchat.init(videoId);
  let chatLis = {};
  let timeStampLis = [];
  let pvsTimeStamp = 0;
  let timestampDiff = 0;
  let wordHeatMap = new Map();
  try {
    // Listen for live chat
    mc.on("chat", (chat) => {
      const chatTimestamp = chat.timestampUsec;
      timestampDiff = chatTimestamp - pvsTimeStamp;
      if (timestampDiff > 60000000) {
        extractWordHeatMap(pvsTimeStamp, timeStampLis, wordHeatMap);
        // rounds pvsTimestamp to the nearest minute
        pvsTimeStamp = chatTimestamp - (chatTimestamp % 60000000);
        timeStampLis = [];
      }
      let message = { timeStamp: chatTimestamp, message: exrMsg(chat.message) };
      timeStampLis.push(message);
      if (!chatLis[pvsTimeStamp]) {
        chatLis[pvsTimeStamp] = [];
      }
      chatLis[pvsTimeStamp].push(message);
    });

    // Handle errors
    mc.on("error", (err) => {
      console.log(err.code);
      console.log(err.stack);
    });

    // Handle end event
    mc.on("end", () => {
      const { statsJson, chatJson } = exrData(chatLis, wordHeatMap, videoId).then(() => {
        console.log("Data extracted");
      });
      redisService.cacheJson(videoId + 'stat', statsJson);
      redisService.cacheJson(videoId, chatJson);
      // console.log("Live stream has ended");
      console.log("Live stream has ended");
    });
    console.log("listening to " + videoId + " live chat.");
    res.json({ success: true, message: "Started listening to live chat." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }

  return { mc: mc, chatLis: chatLis, wordHeatMap: wordHeatMap };
}

async function exrData(chatLis, wordHeatMap, videoId) {
  // let row = "";
  // for (let i in chatLis) {
  //   let data = chatLis[i];
  //   row += data.timeStamp + "," + data.message + "\r\n";
  // }

  // row = ;
  const t1 = performance.now();
  const chatJson = JSON.stringify(chatLis);

  const mapAsObject = Object.fromEntries(wordHeatMap.entries());
  const statsJson = JSON.stringify(mapAsObject);
  writeFile(
    `./output/${videoId}${VID_MSG_NM}.json`,
    chatJson,
    (err) => {
      if (err) throw err;
      console.log("Data written to file");
    },
    () => {
      const t2 = performance.now();
      console.log("Time taken to write file: ", t2 - t1, "ms");
    }
  );
  if (wordHeatMap) {

    writeFile(
      `./output/${videoId}${VID_STATS_NM}.json`,
      statsJson,
      (err) => {
        if (err) throw err;
        console.log("Data written to file");
      },
      () => {
        const t2 = performance.now();
        console.log("Time taken to write file: ", t2 - t1, "ms");
        wordHeatMap.clear();
      }
    );

  }

  chatLis = [];
  return { statsJson, chatJson };
}

function exrMsg(messageLis) {
  let str = "";
  for (const i in messageLis) {
    let msg = messageLis[i];
    if (msg.text) {
      str += msg.text.replace(/,/g, " ") + " ";
    }
    try {
      if (msg.emoji) {
        str += msg.emoji.shortcuts[0] + " ";
      }
    } catch (e) {
      console.log(msg.emoji.emojiId);
      console.log(e);
    }
  }
  return str;
}

async function dlVid(id) {
  const stream = await yt.download(id, {
    type: "video+audio", // audio, video or video+audio
    quality: "144p", // best, bestefficiency, 144p, 240p, 480p, 720p and so on.
    format: "mp4", // media container format
  });

  const file = createWriteStream(`${OUT_PATH}/vid/${id}.mp4`);

  for await (const chunk of Utils.streamToIterable(stream)) {
    file.write(chunk);
  }
  return file;
}

async function cutVideo(from, to, id) {

  const fileNm = `${OUT_PATH}/vid/${id}.mp4`;

  // Check if the parameters are valid
  if (!from || !to || !id) {
    throw new Error("Invalid parameters");
  }

  // Check if the ffmpeg executable exists
  if (!existsSync("/usr/bin/ffmpeg")) {
    throw new Error("ffmpeg executable not found");
  }

  // Replace colons in 'from' and 'to' timestamps with an empty string
  const from_fixed = from.replace(":", "");
  const to_fixed = to.replace(":", "");

  // Execute the ffmpeg command with the adjusted parameters
  exec(
    `ffmpeg -ss ${from} -to ${to} -i ${fileNm} -c copy ${OUT_PATH}/vid/${from_fixed}-${to_fixed}-${id}.mp4`,
    (error, stdout, stderr) => {
      if (error) {
        console.log(`error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
    }
  );
  // Success!
  console.log(`Successfully cut video from ${from} to ${to}`);
}

function ffmpegTime(seconds) {
  return seconds.toFixed(3).replace(/\.?0+$/, '');
}

function safeFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '');
}

function isUsableMediaFormat(fmt) {
  return Boolean(fmt.itag && fmt.mime_type && !fmt.has_text);
}

function pickMediaFormat(formats, predicate) {
  const candidates = formats
    .filter(isUsableMediaFormat)
    .filter(predicate)
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  return candidates[0];
}

function selectMediaFormats(info, outputFormat, quality) {
  const adaptiveFormats = info.streaming_data?.adaptive_formats || [];
  const videoContainer = outputFormat === 'webm' ? 'webm' : 'mp4';
  const audioContainer = outputFormat === 'webm' ? 'webm' : 'mp4';

  if (outputFormat === 'mp3') {
    const audio = pickMediaFormat(
      adaptiveFormats,
      (fmt) => fmt.has_audio && !fmt.has_video
    );
    if (!audio) {
      throw httpError(500, 'No usable audio stream found for this video');
    }
    return { audio };
  }

  const exactVideo = quality && !['best', 'bestefficiency'].includes(quality)
    ? pickMediaFormat(
      adaptiveFormats,
      (fmt) =>
        fmt.has_video &&
        !fmt.has_audio &&
        fmt.mime_type?.includes(videoContainer) &&
        fmt.quality_label === quality
    )
    : null;

  const video = exactVideo || pickMediaFormat(
    adaptiveFormats,
    (fmt) => fmt.has_video && !fmt.has_audio && fmt.mime_type?.includes(videoContainer)
  );
  const audio = pickMediaFormat(
    adaptiveFormats,
    (fmt) => fmt.has_audio && !fmt.has_video && fmt.mime_type?.includes(audioContainer)
  );

  if (!video || !audio) {
    throw httpError(500, 'No usable audio/video stream found for this video');
  }

  return { video, audio };
}

async function loadClipMediaPlan(id, outputFormat, quality) {
  const info = await yt.getInfo(id, { client: 'ANDROID' });
  if (info.basic_info?.is_live) {
    throw httpError(400, 'Live videos are not supported by this endpoint');
  }

  const requestedQuality = quality || '360p';
  const mediaFormats = selectMediaFormats(info, outputFormat, requestedQuality);

  return { info, mediaFormats };
}

function parseClipWindow(from, to) {
  const fromSeconds = parseTimestamp(from, 'from');
  const toSeconds = parseTimestamp(to, 'to');
  const durationSeconds = toSeconds - fromSeconds;

  if (durationSeconds <= 0) {
    throw httpError(400, '"to" must be greater than "from"');
  }
  if (durationSeconds > MAX_SEGMENT_SECONDS) {
    throw httpError(400, `Segment cannot be longer than ${MAX_SEGMENT_SECONDS} seconds`);
  }

  return { fromSeconds, durationSeconds };
}

function ytDlpFormatSelector(mediaFormats) {
  if (mediaFormats.video && mediaFormats.audio) {
    return `${mediaFormats.video.itag}+${mediaFormats.audio.itag}`;
  }
  if (mediaFormats.audio) {
    return String(mediaFormats.audio.itag);
  }
  throw httpError(500, 'No usable adaptive source found for this video');
}

async function generateAdaptiveClipWithYtDlp(id, mediaFormats, fromSeconds, durationSeconds, outputFormat, filePath, signal) {
  const toSeconds = fromSeconds + durationSeconds;
  const flags = {
    format: ytDlpFormatSelector(mediaFormats),
    output: filePath,
    downloadSections: `*${ffmpegTime(fromSeconds)}-${ffmpegTime(toSeconds)}`,
    forceKeyframesAtCuts: true,
    noWarnings: true,
    noPart: true
  };

  if (outputFormat === 'mp3') {
    flags.extractAudio = true;
    flags.audioFormat = 'mp3';
    flags.audioQuality = '192K';
  } else {
    flags.mergeOutputFormat = outputFormat;
  }

  const subprocess = youtubedl.exec(`https://www.youtube.com/watch?v=${id}`, flags);
  let aborted = false;
  const abort = () => {
    aborted = true;
    try { subprocess.kill('SIGKILL'); } catch {}
  };

  if (signal?.aborted) {
    abort();
  } else {
    signal?.addEventListener('abort', abort, { once: true });
  }

  try {
    await subprocess;
  } catch (err) {
    if (aborted) {
      throw httpError(499, 'Clip generation was cancelled');
    }
    throw err;
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}

/**
 * Generates a clipped YouTube segment using a preloaded media plan.
 *
 * This is used by batch generation to avoid calling YouTube for the same
 * video metadata once per clip. Callers are responsible for loading a media
 * plan with loadClipMediaPlan using the same outputFormat and quality.
 *
 * @param {string} id YouTube video id.
 * @param {string|number} from Segment start time.
 * @param {string|number} to Segment end time, must be greater than from.
 * @param {string=} quality Requested YouTube quality label.
 * @param {"mp4"|"mp3"|"webm"} outputFormat Output container/encoding.
 * @param {{ mediaFormats: object }} mediaPlan Preloaded media plan.
 * @param {{ signal?: AbortSignal }=} options Optional cancellation signal.
 * @returns {Promise<{ filename: string, filePath: string, relativePath: string, format: string, quality: string, from: string, to: string, sourceType: "adaptive" }>}
 */
async function genClipFileWithMediaPlan(id, from, to, quality, outputFormat, mediaPlan, options = {}) {
  const fmt = ['mp4', 'mp3', 'webm'].includes(outputFormat) ? outputFormat : 'mp4';
  const requestedQuality = quality || '360p';
  const { fromSeconds, durationSeconds } = parseClipWindow(from, to);
  const { mediaFormats } = mediaPlan;
  const sourceType = 'adaptive';

  const outputDir = path.join(OUT_PATH, 'vid');
  mkdirSync(outputDir, { recursive: true });

  const timestamp = Date.now();
  const filename = [
    safeFilePart(id),
    safeFilePart(String(from)),
    safeFilePart(String(to)),
    safeFilePart(requestedQuality),
    timestamp,
    randomUUID()
  ].filter(Boolean).join('-') + `.${fmt}`;
  const filePath = path.join(outputDir, filename);
  const relativePath = path.join('vid', filename).replace(/\\/g, '/');

  if (options.signal?.aborted) {
    throw httpError(499, 'Clip generation was cancelled');
  }

  try {
    await generateAdaptiveClipWithYtDlp(id, mediaFormats, fromSeconds, durationSeconds, fmt, filePath, options.signal);
    return {
      filename,
      filePath,
      relativePath,
      format: fmt,
      quality: requestedQuality,
      from: String(from),
      to: String(to),
      sourceType
    };
  } catch (err) {
    try { unlinkSync(filePath); } catch {}
    if (options.signal?.aborted) {
      throw httpError(499, 'Clip generation was cancelled');
    }
    throw httpError(500, err.stderr || err.message);
  }
}

/**
 * Generates a clipped YouTube segment under OUT_PATH/vid and resolves after
 * youtube-dl-exec has fully written the file.
 *
 * @param {string} id YouTube video id.
 * @param {string|number} from Segment start time.
 * @param {string|number} to Segment end time, must be greater than from.
 * @param {string=} quality Requested YouTube quality label.
 * @param {"mp4"|"mp3"|"webm"} outputFormat Output container/encoding.
 * @param {{ signal?: AbortSignal }=} options Optional cancellation signal.
 * @returns {Promise<{ filename: string, filePath: string, relativePath: string, format: string, quality: string, from: string, to: string, sourceType: "adaptive" }>}
 */
async function genClipFile(id, from, to, quality, outputFormat, options = {}) {
  const fmt = ['mp4', 'mp3', 'webm'].includes(outputFormat) ? outputFormat : 'mp4';
  const requestedQuality = quality || '360p';
  const mediaPlan = await loadClipMediaPlan(id, fmt, requestedQuality);
  return genClipFileWithMediaPlan(id, from, to, requestedQuality, fmt, mediaPlan, options);
}

export {
  listenYt,
  cutVideo,
  yt,
  dlVid,
  genClipFile,
  genClipFileWithMediaPlan,
  loadClipMediaPlan,
  parseTimestamp,
  MAX_SEGMENT_SECONDS
};
