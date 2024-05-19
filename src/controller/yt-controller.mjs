import { listenYt, dlVid, yt } from "../utils/yt-util.mjs";
import { fmtTimestamp } from "../utils/math-util.mjs";
import { ChatAnalyzer } from '../services/chat-analyzer.mjs';
import set from "lodash/set.js";


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
}
//export { listenCh, listen, getId, endListener, analyze };
