import { writeFile, existsSync, createWriteStream, mkdirSync, unlinkSync } from "fs";
import { exec, spawn } from "child_process";
import { createServer } from "http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Readable } from "stream";
import vm from "node:vm";
import { Masterchat } from "@kenolion/masterchat";
import youtubedl from "youtube-dl-exec";
import { extractWordHeatMap } from "../utils/data-prc-util.mjs";
import { VID_STATS_NM, VID_MSG_NM } from "../constants/app-const.mjs";
import { Innertube, Utils } from "youtubei.js";
import { OUT_PATH } from "../constants/app-const.mjs";

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

const MAX_SEGMENT_SECONDS = 10 * 60;

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function parseTimestamp(value, name) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    throw httpError(400, `"${name}" query param is required`);
  }
  if (!/^\d+(?::\d{1,2}){0,2}(?:\.\d+)?$/.test(raw)) {
    throw httpError(400, `"${name}" must be SS, MM:SS, or HH:MM:SS`);
  }

  const parts = raw.split(':');
  const partCount = parts.length;
  const seconds = Number(parts.pop());
  const minutes = parts.length ? Number(parts.pop()) : 0;
  const hours = parts.length ? Number(parts.pop()) : 0;

  if (
    !Number.isFinite(seconds) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(hours) ||
    (partCount > 2 && minutes >= 60) ||
    (partCount > 1 && seconds >= 60)
  ) {
    throw httpError(400, `"${name}" is not a valid timestamp`);
  }

  return (hours * 3600) + (minutes * 60) + seconds;
}

function ffmpegTime(seconds) {
  return seconds.toFixed(3).replace(/\.?0+$/, '');
}

function safeFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '');
}

function isUsableMediaFormat(fmt) {
  if (!fmt.url && !fmt.cipher && !fmt.signature_cipher) return true;
  return fmt.has_text;
}

function pickMediaFormat(formats, predicate) {
  const candidates = formats
    .filter((fmt) => !isUsableMediaFormat(fmt))
    .filter(predicate)
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  return candidates[0];
}

async function decipherMediaUrl(format, cpn) {
  const url = new URL(await format.decipher(yt.session.player));
  if (cpn && !url.searchParams.has('cpn')) {
    url.searchParams.set('cpn', cpn);
  }
  return url.toString();
}

async function createMediaRangeProxy(mediaSources) {
  function proxyPathForSource(name, source) {
    const mimeType = source.mimeType || '';
    const extension = mimeType === 'audio/mp4'
      ? 'm4a'
      : mimeType.startsWith('video/') || mimeType.startsWith('audio/')
        ? mimeType.split('/')[1]
        : 'bin';
    return `/${name}.${extension}`;
  }

  const sourcesByPath = new Map(
    Object.entries(mediaSources).map(([name, source]) => [proxyPathForSource(name, source), source])
  );
  const upstreamChunkSize = 1024 * 1024;

  async function streamSourceRange(source, start, end, proxyRes) {
    let cursor = start;
    while (cursor <= end) {
      const chunkEnd = Math.min(cursor + upstreamChunkSize - 1, end);
      const upstreamUrl = new URL(source.url);
      upstreamUrl.searchParams.set('range', `${cursor}-${chunkEnd}`);
      const upstream = await fetch(upstreamUrl, {
        headers: {
          accept: '*/*',
          origin: 'https://www.youtube.com',
          referer: 'https://www.youtube.com',
          DNT: '?1'
        }
      });

      if (!upstream.ok || !upstream.body) {
        const bodyText = await upstream.text().catch(() => '');
        throw httpError(
          upstream.status || 502,
          `${upstreamUrl.origin}${upstreamUrl.pathname}: Server returned ${upstream.status || 502} ${upstream.statusText || ''}${bodyText ? ` (${bodyText})` : ''}`.trim()
        );
      }

      for await (const chunk of Readable.fromWeb(upstream.body)) {
        if (!proxyRes.write(chunk)) {
          await new Promise((resolve) => proxyRes.once('drain', resolve));
        }
      }

      cursor = chunkEnd + 1;
    }
  }

  const server = createServer(async (req, proxyRes) => {
    const source = sourcesByPath.get(new URL(req.url, 'http://127.0.0.1').pathname);
    if (!source) {
      proxyRes.writeHead(404);
      proxyRes.end();
      return;
    }

    const length = Number(source.contentLength);
    const match = /^bytes=(\d+)-(\d*)$/i.exec(req.headers.range || '');
    const hasRange = Boolean(match);
    const start = hasRange ? Number(match[1]) : 0;
    const requestedEnd = hasRange && match[2] ? Number(match[2]) : length - 1;
    const end = Math.min(requestedEnd, length - 1);

    if (!Number.isFinite(length) || length <= 0 || start >= length || end < start) {
      proxyRes.writeHead(416, {
        'Content-Range': `bytes */${Number.isFinite(length) ? length : '*'}`
      });
      proxyRes.end();
      return;
    }

    try {
      const responseHeaders = {
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1),
        'Content-Type': source.mimeType || 'application/octet-stream'
      };
      if (hasRange) {
        responseHeaders['Content-Range'] = `bytes ${start}-${end}/${length}`;
      }
      proxyRes.writeHead(hasRange ? 206 : 200, responseHeaders);
      await streamSourceRange(source, start, end, proxyRes);
      proxyRes.end();
    } catch (err) {
      if (proxyRes.headersSent) {
        proxyRes.destroy(err);
        return;
      }
      proxyRes.writeHead(err.statusCode || 502);
      proxyRes.end(err.message);
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address();
  return {
    urls: Object.fromEntries(
      Object.entries(mediaSources).map(([name, source]) => [name, `http://127.0.0.1:${port}${proxyPathForSource(name, source)}`])
    ),
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function selectMediaFormats(info, outputFormat, quality) {
  const adaptiveFormats = info.streaming_data?.adaptive_formats || [];
  const muxedFormats = info.streaming_data?.formats || [];
  const videoContainer = outputFormat === 'webm' ? 'webm' : 'mp4';
  const audioContainer = outputFormat === 'webm' ? 'webm' : 'mp4';

  if (outputFormat === 'mp3') {
    const muxed = pickMediaFormat(
      muxedFormats,
      (fmt) =>
        fmt.has_audio &&
        fmt.has_video &&
        fmt.mime_type.includes(audioContainer)
    );
    const audio = pickMediaFormat(
      adaptiveFormats,
      (fmt) => fmt.has_audio && !fmt.has_video
    );
    if (!muxed && !audio) {
      throw httpError(500, 'No usable audio stream found for this video');
    }
    return muxed ? { av: muxed } : { audio };
  }

  if (outputFormat === 'mp4') {
    const muxed = quality && !['best', 'bestefficiency'].includes(quality)
      ? pickMediaFormat(
        muxedFormats,
        (fmt) =>
          fmt.has_video &&
          fmt.has_audio &&
          fmt.mime_type.includes(videoContainer) &&
          fmt.quality_label === quality
      )
      : pickMediaFormat(
        muxedFormats,
        (fmt) =>
          fmt.has_video &&
          fmt.has_audio &&
          fmt.mime_type.includes(videoContainer)
      );

    if (muxed) {
      return { av: muxed };
    }
  }

  const exactVideo = quality && !['best', 'bestefficiency'].includes(quality)
    ? pickMediaFormat(
      adaptiveFormats,
      (fmt) =>
        fmt.has_video &&
        !fmt.has_audio &&
        fmt.mime_type.includes(videoContainer) &&
        fmt.quality_label === quality
    )
    : null;

  const video = exactVideo || pickMediaFormat(
    adaptiveFormats,
    (fmt) => fmt.has_video && !fmt.has_audio && fmt.mime_type.includes(videoContainer)
  );
  const audio = pickMediaFormat(
    adaptiveFormats,
    (fmt) => fmt.has_audio && !fmt.has_video && fmt.mime_type.includes(audioContainer)
  );

  if (!video || !audio) {
    throw httpError(500, 'No usable audio/video stream found for this video');
  }

  return { video, audio };
}

function buildFfmpegArgs(fromSeconds, durationSeconds, outputFormat, mediaUrls, outputTarget = 'pipe:1') {
  const args = [
    '-hide_banner',
    '-loglevel', 'error'
  ];

  if (!mediaUrls.dash) {
    args.push(
      '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      '-headers', 'Referer: https://www.youtube.com/\r\nOrigin: https://www.youtube.com/\r\n'
    );
  }

  if (mediaUrls.dash) {
    args.push(
      '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
      '-f', 'dash',
      '-allowed_extensions', 'ALL',
      '-i', mediaUrls.dash,
      '-ss', ffmpegTime(fromSeconds),
      '-t', ffmpegTime(durationSeconds)
    );

    if (outputFormat === 'mp3') {
      args.push(
        '-map', '0:a:0?',
        '-vn',
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        '-f', 'mp3'
      );
    } else if (outputFormat === 'webm') {
      args.push(
        '-map', '0:v:0?',
        '-map', '0:a:0?',
        '-c:v', 'libvpx-vp9',
        '-deadline', 'realtime',
        '-cpu-used', '6',
        '-b:v', '0',
        '-crf', '32',
        '-c:a', 'libopus',
        '-f', 'webm'
      );
    } else {
      args.push(
        '-map', '0:v:0?',
        '-map', '0:a:0?',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-f', 'mp4'
      );
    }
  } else if (outputFormat === 'mp3') {
    if (mediaUrls.av) {
      args.push(
        '-i', mediaUrls.av,
        '-ss', ffmpegTime(fromSeconds),
        '-t', ffmpegTime(durationSeconds),
        '-map', '0:a:0',
        '-vn',
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        '-f', 'mp3'
      );
    } else {
      args.push(
        '-i', mediaUrls.audio,
        '-ss', ffmpegTime(fromSeconds),
        '-t', ffmpegTime(durationSeconds),
        '-map', '0:a:0',
        '-vn',
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        '-f', 'mp3'
      );
    }
  } else if (mediaUrls.av) {
    args.push(
      '-i', mediaUrls.av,
      '-ss', ffmpegTime(fromSeconds),
      '-t', ffmpegTime(durationSeconds),
      '-map', '0:v:0?',
      '-map', '0:a:0?',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4'
    );
  } else if (outputFormat === 'webm') {
    args.push(
      '-i', mediaUrls.video,
      '-i', mediaUrls.audio,
      '-ss', ffmpegTime(fromSeconds),
      '-t', ffmpegTime(durationSeconds),
      '-map', '0:v:0?',
      '-map', '1:a:0?',
      '-c:v', 'libvpx-vp9',
      '-deadline', 'realtime',
      '-cpu-used', '6',
      '-b:v', '0',
      '-crf', '32',
      '-c:a', 'libopus',
      '-f', 'webm'
    );
  } else {
    args.push(
      '-i', mediaUrls.video,
      '-i', mediaUrls.audio,
      '-ss', ffmpegTime(fromSeconds),
      '-t', ffmpegTime(durationSeconds),
      '-map', '0:v:0?',
      '-map', '1:a:0?',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4'
    );
  }

  args.push(outputTarget);
  return args;
}

async function loadClipMediaPlan(id, outputFormat, quality) {
  const info = await yt.getInfo(id, { client: 'ANDROID' });
  if (info.basic_info?.is_live) {
    throw httpError(400, 'Live videos are not supported by this endpoint');
  }

  const requestedQuality = quality || '360p';
  const mediaFormats = selectMediaFormats(info, outputFormat, requestedQuality);
  const avCpn = info.cpn;
  const videoCpn = info.cpn;
  const audioCpn = info.cpn;

  const mediaSources = {};
  if (mediaFormats.av) {
    mediaSources.av = {
      url: await decipherMediaUrl(mediaFormats.av, avCpn),
      contentLength: mediaFormats.av.content_length,
      mimeType: mediaFormats.av.mime_type.split(';')[0]
    };
  }
  if (mediaFormats.video) {
    mediaSources.video = {
      url: await decipherMediaUrl(mediaFormats.video, videoCpn),
      contentLength: mediaFormats.video.content_length,
      mimeType: mediaFormats.video.mime_type.split(';')[0]
    };
  }
  if (mediaFormats.audio) {
    mediaSources.audio = {
      url: await decipherMediaUrl(mediaFormats.audio, audioCpn),
      contentLength: mediaFormats.audio.content_length,
      mimeType: mediaFormats.audio.mime_type.split(';')[0]
    };
  }

  return { info, mediaFormats, mediaSources };
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

function closeProxy(mediaProxy) {
  return mediaProxy?.close().catch(() => {});
}

function usesSingleMuxedSource(mediaSources) {
  return Boolean(mediaSources?.av) && !mediaSources?.video && !mediaSources?.audio;
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

async function generateAdaptiveClipWithYtDlp(id, mediaFormats, fromSeconds, durationSeconds, outputFormat, filePath) {
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

  await youtubedl(`https://www.youtube.com/watch?v=${id}`, flags);
}

/**
 * Generates a clipped YouTube segment under OUT_PATH/vid and resolves after
 * ffmpeg has fully written the file.
 *
 * @param {string} id YouTube video id.
 * @param {string|number} from Segment start time.
 * @param {string|number} to Segment end time, must be greater than from.
 * @param {string=} quality Requested YouTube quality label.
 * @param {"mp4"|"mp3"|"webm"} outputFormat Output container/encoding.
 * @param {{ signal?: AbortSignal }=} options Optional cancellation signal.
 * @returns {Promise<{ filename: string, filePath: string, relativePath: string, format: string, quality: string, from: string, to: string, sourceType: "muxed"|"adaptive" }>}
 */
async function genClipFile(id, from, to, quality, outputFormat, options = {}) {
  const fmt = ['mp4', 'mp3', 'webm'].includes(outputFormat) ? outputFormat : 'mp4';
  const requestedQuality = quality || '360p';
  const { fromSeconds, durationSeconds } = parseClipWindow(from, to);

  const outputDir = path.join(OUT_PATH, 'vid');
  mkdirSync(outputDir, { recursive: true });
  const { mediaFormats, mediaSources } = await loadClipMediaPlan(id, fmt, requestedQuality);
  const sourceType = usesSingleMuxedSource(mediaSources) ? 'muxed' : 'adaptive';

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

  if (sourceType === 'adaptive') {
    try {
      await generateAdaptiveClipWithYtDlp(id, mediaFormats, fromSeconds, durationSeconds, fmt, filePath);
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
      throw httpError(500, err.stderr || err.message);
    }
  }

  let mediaProxy = null;
  let tempFiles = [];
  let mediaUrls;
  mediaUrls = { av: mediaSources.av.url };
  const ff = spawn('ffmpeg', buildFfmpegArgs(fromSeconds, durationSeconds, fmt, mediaUrls, filePath), {
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let stderr = '';
  let aborted = false;

  const abort = () => {
    aborted = true;
    if (!ff.killed) ff.kill('SIGKILL');
  };
  if (options.signal?.aborted) {
    abort();
  } else {
    options.signal?.addEventListener('abort', abort, { once: true });
  }

  ff.stderr.on('data', (d) => {
    stderr += d.toString();
  });

  return new Promise((resolve, reject) => {
    ff.on('error', async (err) => {
      options.signal?.removeEventListener('abort', abort);
      await closeProxy(mediaProxy);
      for (const tempFile of tempFiles) {
        try { unlinkSync(tempFile); } catch {}
      }
      try { unlinkSync(filePath); } catch {}
      reject(httpError(500, `ffmpeg spawn error: ${err.message}`));
    });

    ff.on('close', async (code) => {
      options.signal?.removeEventListener('abort', abort);
      await closeProxy(mediaProxy);
      for (const tempFile of tempFiles) {
        try { unlinkSync(tempFile); } catch {}
      }

      if (aborted) {
        try { unlinkSync(filePath); } catch {}
        reject(httpError(499, 'Clip generation was cancelled'));
        return;
      }

      if (code === 0) {
        resolve({
          filename,
          filePath,
          relativePath,
          format: fmt,
          quality: requestedQuality,
          from: String(from),
          to: String(to),
          sourceType
        });
        return;
      }

      try { unlinkSync(filePath); } catch {}
      const message = stderr.trim() || `ffmpeg exited with code ${code}`;
      reject(httpError(500, message));
    });
  });
}

/**
 * Streams a clipped YouTube segment directly to an Express response.
 *
 * This does not download the full video to disk. It asks youtubei.js for the
 * video's adaptive media streams, chooses direct audio/video URLs, and lets
 * ffmpeg seek into those remote inputs before transcoding only the requested
 * time window to stdout.
 *
 * Route example:
 *   GET /download/jNQXAC9IVRw?from=00:01&to=00:03&quality=144p&format=mp4
 *
 * Direct usage:
 *   await streamVidSegment(
 *     'jNQXAC9IVRw', // YouTube video id
 *     '00:01',       // start time: SS, MM:SS, or HH:MM:SS
 *     '00:03',       // end time, must be greater than from
 *     '144p',        // optional; defaults to 360p at the controller layer
 *     'mp4',         // mp4, mp3, or webm
 *     res            // Express response object
 *   );
 *
 * Supported output formats:
 * - mp4: H.264 + AAC, fragmented MP4 for HTTP streaming.
 * - mp3: audio-only MP3.
 * - webm: VP9 + Opus.
 *
 * Validation and limits:
 * - Timestamps can be numeric seconds, MM:SS, or HH:MM:SS.
 * - The segment length is capped by MAX_SEGMENT_SECONDS.
 * - Active live videos are rejected.
 * - Errors thrown before headers are sent include statusCode for controller use.
 *
 * Operational requirements:
 * - ffmpeg must be available on PATH.
 * - Network access to YouTube/googlevideo URLs is required.
 *
 * @param {string} id YouTube video id.
 * @param {string|number} from Segment start time.
 * @param {string|number} to Segment end time.
 * @param {string=} quality Requested YouTube quality label, for example "144p" or "720p".
 * @param {"mp4"|"mp3"|"webm"} outputFormat Response container/encoding.
 * @param {import("express").Response} res Express response to stream into.
 * @returns {Promise<void>} Resolves when ffmpeg exits or the client disconnects.
 */
async function streamVidSegment(id, from, to, quality, outputFormat, res) {
  const fmt = ['mp4', 'mp3', 'webm'].includes(outputFormat) ? outputFormat : 'mp4';
  const { fromSeconds, durationSeconds } = parseClipWindow(from, to);
  const { mediaSources } = await loadClipMediaPlan(id, fmt, quality || '360p');

  const mimeTypes = { mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg' };
  const filename = [
    safeFilePart(id),
    safeFilePart(String(from)),
    safeFilePart(String(to))
  ].filter(Boolean).join('-');

  res.setHeader('Content-Type', mimeTypes[fmt]);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.${fmt}"`);

  const mediaProxy = usesSingleMuxedSource(mediaSources) ? null : await createMediaRangeProxy(mediaSources);
  const mediaUrls = mediaProxy ? mediaProxy.urls : { av: mediaSources.av.url };
  const ff = spawn('ffmpeg', buildFfmpegArgs(fromSeconds, durationSeconds, fmt, mediaUrls), {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  let clientClosed = false;

  ff.stderr.on('data', (d) => {
    stderr += d.toString();
  });

  ff.stdout.pipe(res);

  res.on('close', () => {
      if (!res.writableEnded) {
        clientClosed = true;
        if (!ff.killed) ff.kill('SIGKILL');
      }
  });

  return new Promise((resolve, reject) => {
    ff.on('error', (err) => {
      if (!res.headersSent) {
        reject(httpError(500, `ffmpeg spawn error: ${err.message}`));
        return;
      }
      reject(err);
    });

    ff.on('close', (code) => {
      if (clientClosed) {
        mediaProxy.close();
        resolve();
        return;
      }
      if (code === 0) {
        mediaProxy.close();
        resolve();
        return;
      }
      const message = stderr.trim() || `ffmpeg exited with code ${code}`;
      if (!res.headersSent) {
        mediaProxy.close();
        reject(httpError(500, message));
        return;
      }
      console.error(message);
      mediaProxy.close();
      resolve();
    });
  });
}

export { listenYt, cutVideo, yt, dlVid, streamVidSegment, genClipFile };
