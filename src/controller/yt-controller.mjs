import { existsSync } from "node:fs";
import path from "node:path";
import { listenYt, dlVid, yt, genClipFile } from "../utils/yt-util.mjs";
import { fmtTimestamp } from "../utils/math-util.mjs";
import { ChatAnalyzer } from '../services/chat-analyzer.mjs';
import set from "lodash/set.js";
import { OUT_PATH } from "../constants/app-const.mjs";


const ytChatObj = {};
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
      res.json(fmtTimestamp(ytChatObj[id].timestamp, req.query.t));
      return;
    }
    yt.getBasicInfo(id).then((info) => {
      let time = info.basic_info.start_timestamp;
      let tim = new Date(time).valueOf();
      ytChatObj[id].timestamp = tim;
      console.log(fmtTimestamp(tim, req.query.t));

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

  static analyze(req, res,redisService) {
    const id = req.params.id; // Get the value of the :id path variable
    const { wordLis } = req.body; // Get the value of the 'wordLis' property from the request body

    // Initialize the ChatAnalyzer object
    let ca = new ChatAnalyzer(wordLis);
    set(ytChatObj[id], "ca", ca);
    ca.load(id).then((file) => {
      const obj = ca.analyze(null, null);
      redisService.cacheJson(id + 'analysis', obj);
      res.send(`POST request received for ID ${id}`);
    });
  }
  static async genClip(req, res) {
    const { id } = req.params;
    const body = req.body || {};
    const from = body.from ?? req.query.from;
    const to = body.to ?? req.query.to;
    const quality = body.quality ?? req.query.quality ?? '360p';
    const requestedFormat = body.format ?? req.query.format ?? body.fmt ?? req.query.fmt;
    const outputFormat = ['mp4', 'mp3', 'webm'].includes(requestedFormat) ? requestedFormat : 'mp4';

    if (!from || !to) {
      return res.status(400).json({ error: '"from" and "to" are required' });
    }

    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abortController.abort();
    });

    try {
      const clip = await genClipFile(id, from, to, quality, outputFormat, {
        signal: abortController.signal
      });

      return res.status(201).json({
        success: true,
        id,
        filename: clip.filename,
        path: clip.relativePath,
        url: `/clip/${clip.filename}`,
        format: clip.format,
        quality: clip.quality,
        from: clip.from,
        to: clip.to
      });
    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        return res.status(err.statusCode || 500).json({ error: err.message });
      }
    }
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
