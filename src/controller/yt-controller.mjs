import { existsSync } from "node:fs";
import path from "node:path";
import {
  listenYt,
  dlVid,
  yt,
  genClipFile,
  genClipFileWithMediaPlan,
  loadClipMediaPlan
} from "../utils/yt-util.mjs";
import { cnvTimestampToMin } from "../utils/math-util.mjs";
import { ChatAnalyzer } from '../services/chat-analyzer.mjs';
import set from "lodash/set.js";
import { OUT_PATH } from "../constants/app-const.mjs";
import {
  batchStatusCode,
  buildBatchClipJobs,
  errorResponse,
  normalizeBatchClipOffset,
  validateBatchClipInput
} from "../utils/clip-batch-util.mjs";


const ytChatObj = {};

function clipResponse(id, clip, extra = {}) {
  return {
    ...extra,
    filename: clip.filename,
    path: clip.relativePath,
    url: `/clip/${clip.filename}`,
    format: clip.format,
    quality: clip.quality,
    sourceType: clip.sourceType,
    from: clip.from,
    to: clip.to
  };
}

// youtube chat API
export default class YtController {
  static listenCh(req, res, redisService) {
    listenYt(req.params.id, req.params.channelId, res, redisService).then((yt) => {
      set(ytChatObj, req.params.id, yt);
      yt.mc.listen();
      return res;
    });
  }

  static getId(req, res) {
    // res.setHeader("Content-Type", "application/json");
    let id = req.params.id;
    if (!ytChatObj[id]) {
      ytChatObj[id] = {};
    }
    if (ytChatObj[id] && ytChatObj[id].timestamp) {
      res.json(cnvTimestampToMin(ytChatObj[id].timestamp, req.query.t));
      return;
    }
    yt.getBasicInfo(id).then((info) => {
      let time = info.basic_info.start_timestamp;
      let tim = new Date(time).valueOf();
      ytChatObj[id].timestamp = tim;
      console.log(cnvTimestampToMin(tim, req.query.t));

      res.json(info);
    });
  }

  static listen(req, res) {
    // res.setHeader("Content-Type", "application/json");
    listenYt(req.params.id, null, res).then((yt) => {
      set(ytChatObj, req.params.id, yt);
      yt.mc.listen();
      return res;
    });
  }

  static endListener(req, res) {
    let id = req.params.id;
    const masterChat = ytChatObj[id].mc;
    masterChat?.stop();
    return res.json({
      success: true,
      message: `Ended listening to ${id} live chat.`,
    });
  }

  static async analyze(req, res, redisService) {
    const id = req.params.id; // Get the value of the :id path variable
    const { wordLis, options } = req.body || {}; // Get the value of the 'wordLis' property from the request body

    if (!Array.isArray(wordLis) || wordLis.length === 0) {
      return res.status(400).json({ error: '"wordLis" must be a non-empty array' });
    }

    // Initialize the ChatAnalyzer object
    let ca = new ChatAnalyzer(wordLis, null, options);
    if (!ytChatObj[id]) {
      ytChatObj[id] = {};
    }
    set(ytChatObj[id], "ca", ca);

    try {
      if (!ytChatObj[id].timestamp) {
        const info = await yt.getBasicInfo(id);
        const time = info.basic_info.start_timestamp;
        ytChatObj[id].timestamp = new Date(time).valueOf();
      }

      ca.setVideoStartTimestamp(ytChatObj[id].timestamp);
      await ca.load(id);
      const result = ca.analyze(null, null);
      redisService.cacheJson(id + 'analysis', result);
      return res.json({
        success: true,
        id,
        options: result.options,
        clips: result.clips,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: `Failed to analyze ${id}` });
    }
  }
  /**
   * Handles clip file generation for a YouTube video.
   *
   * Single clip mode is used when the request does not include a "clips"
   * property. It accepts from/to timestamps from either the JSON body or query
   * string, plus optional quality and format/fmt values.
   *
   * Batch mode is selected when the JSON body includes "clips". In that mode,
   * this method normalizes shared request options, creates a request abort
   * signal, and delegates per-item generation to genClipBatch. Batch requests
   * may include offset seconds, which defaults to 90 and shifts the clip start
   * before each timestamp while leaving duration after the timestamp.
   *
   * Accepted timestamp formats are SS, MM:SS, HH:MM:SS, or numeric seconds.
   * Supported output formats are mp4, mp3, and webm. Unsupported formats fall
   * back to mp4, and quality defaults to 360p.
   *
   * @param {import("express").Request} req Express request.
   * @param {import("express").Response} res Express response.
   * @returns {Promise<import("express").Response|void>} Sends a JSON response unless the client disconnects.
   */
  static async genClip(req, res) {
    const { id } = req.params;
    const body = req.body || {};
    const from = body.from ?? req.query.from;
    const to = body.to ?? req.query.to;
    const quality = body.quality ?? req.query.quality ?? '360p';
    const rawOffset = body.offset ?? req.query.offset;
    const requestedFormat = body.format ?? req.query.format ?? body.fmt ?? req.query.fmt;
    const outputFormat = ['mp4', 'mp3', 'webm'].includes(requestedFormat) ? requestedFormat : 'mp4';

    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abortController.abort();
    });

    if (Object.hasOwn(body, 'clips')) {
      let offset;
      try {
        offset = normalizeBatchClipOffset(rawOffset);
      } catch (err) {
        return res.status(err.statusCode || 400).json({ error: err.message });
      }

      return YtController.genClipBatch(req, res, {
        id,
        quality,
        outputFormat,
        offset,
        abortController
      });
    }

    if (!from || !to) {
      return res.status(400).json({ error: '"from" and "to" are required' });
    }

    try {
      const clip = await genClipFile(id, from, to, quality, outputFormat, {
        signal: abortController.signal
      });

      return res.status(201).json({
        success: true,
        id,
        ...clipResponse(id, clip)
      });
    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        return res.status(err.statusCode || 500).json({ error: err.message });
      }
    }
  }

  /**
   * Generates multiple clips from one YouTube video using a shared media plan.
   *
   * The expected request body is:
   *   {
   *     "clips": [
   *       { "timestamp": "01:23", "duration": 8 }
   *     ],
   *     "quality": "360p",
   *     "format": "mp4",
   *     "offset": 90
   *   }
   *
   * Each item uses timestamp as the peak moment, offset as the number of
   * context seconds before the timestamp, and duration as seconds after the
   * timestamp. The batch is capped by validateBatchClipInput, and each segment
   * is capped by MAX_SEGMENT_SECONDS in the clip time utilities.
   *
   * Valid items are generated even when other items fail validation or clip
   * generation. The response includes generated clips and per-item errors:
   *   {
   *     "success": true,
   *     "id": "VIDEO_ID",
   *     "clips": [{ "index": 0, "url": "/clip/file.mp4", ... }],
   *     "errors": [{ "index": 1, "statusCode": 400, "error": "..." }]
   *   }
   *
   * Response status is 201 when at least one clip is generated, 400 when all
   * failures are validation errors, or 207 when all generated clips fail for at
   * least one non-validation reason.
   *
   * @param {import("express").Request} req Express request.
   * @param {import("express").Response} res Express response.
   * @param {{ id: string, quality: string, outputFormat: "mp4"|"mp3"|"webm", offset: number, abortController: AbortController }} options Shared clip generation options from genClip.
   * @returns {Promise<import("express").Response|void>} Sends a JSON response unless the client disconnects.
   */
  static async genClipBatch(req, res, { id, quality, outputFormat, offset, abortController }) {
    const clipsInput = req.body.clips;
    const validationMessage = validateBatchClipInput(clipsInput);

    if (validationMessage) {
      return res.status(400).json({ error: validationMessage });
    }

    const { jobs, errors } = buildBatchClipJobs(clipsInput, offset);

    if (jobs.length === 0) {
      return res.status(400).json({
        success: false,
        id,
        clips: [],
        errors
      });
    }

    let mediaPlan;
    try {
      mediaPlan = await loadClipMediaPlan(id, outputFormat, quality);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        return res.status(err.statusCode || 500).json({ error: err.message });
      }
      return;
    }

    const generatedClips = [];

    for (const job of jobs) {
      if (abortController.signal.aborted) {
        break;
      }

      try {
        const clip = await genClipFileWithMediaPlan(
          id,
          job.from,
          job.to,
          quality,
          outputFormat,
          mediaPlan,
          { signal: abortController.signal }
        );

        generatedClips.push(clipResponse(id, clip, {
          index: job.index,
          timestamp: job.timestamp,
          duration: job.duration,
          offset: job.offset
        }));
      } catch (err) {
        console.error(err);
        errors.push(errorResponse(job.index, job, err));
        if (err.statusCode === 499 || abortController.signal.aborted) {
          break;
        }
      }
    }

    if (abortController.signal.aborted) {
      return;
    }

    return res.status(batchStatusCode(generatedClips, errors)).json({
      success: generatedClips.length > 0,
      id,
      clips: generatedClips,
      errors
    });
  }

  static getClip(req, res) {
    const filename = path.basename(req.params.filename || '');
    if (!filename) {
      return res.status(404).json({ error: 'Clip not found' });
    }

    const filePath = path.join(OUT_PATH, 'vid', filename);
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Clip not found' });
    }

    return res.download(filePath, filename);
  }
}
