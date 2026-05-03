import YtController from "../controller/yt-controller.mjs";

export default class YtRouter {
  constructor(app, redisMiddleware, db, redisService) {
    this.app = app;
    this.redisMiddleware = redisMiddleware;
    this.db = db;
    this.redisService = redisService;
    this.init();
  }

  // convert to use middleware and then use controller
  init(params) {
    /**
     * Generate one or more clips from a YouTube video.
     *
     * PUT /clips/:id
     *
     * Path params:
     * - id: YouTube video id.
     *
     * Query/body options:
     * - from: single-clip start timestamp. Required when "clips" is omitted.
     * - to: single-clip end timestamp. Required when "clips" is omitted.
     * - quality: optional YouTube quality label. Defaults to "360p".
     * - format or fmt: optional output format. Supports "mp4", "mp3", and "webm";
     *   unsupported values fall back to "mp4".
     * - offset: optional batch-only context seconds before each timestamp.
     *   Defaults to 90.
     *
     * Single-clip JSON body:
     *   {
     *     "from": "01:20",
     *     "to": "01:35",
     *     "quality": "720p",
     *     "format": "mp4"
     *   }
     *
     * Batch JSON body:
     *   {
     *     "clips": [
     *       { "timestamp": "01:20", "duration": 15 },
     *       { "timestamp": "02:05", "duration": 8 }
     *     ],
     *     "quality": "720p",
     *     "format": "mp4",
     *     "offset": 90
     *   }
     *
     * Timestamp values accept SS, MM:SS, HH:MM:SS, or numeric seconds. In batch
     * mode, duration is seconds after timestamp and offset is seconds before
     * timestamp. Batch requests may contain up to 10 items, and each segment may
     * be at most 600 seconds.
     *
     * Successful single-clip response: 201
     *   {
     *     "success": true,
     *     "id": "VIDEO_ID",
     *     "filename": "...mp4",
     *     "path": "vid/...mp4",
     *     "url": "/clip/...mp4",
     *     "format": "mp4",
     *     "quality": "720p",
     *     "sourceType": "adaptive",
     *     "from": "01:20",
     *     "to": "01:35"
     *   }
     *
     * Batch response: 201 when one or more clips are generated, 400 for invalid
     * input/all-validation failures, or 207 when all generated items fail for at
     * least one non-validation reason. The body contains "clips" and "errors"
     * arrays with per-item "index" values.
     */
    this.app.put("/clips/:id", (req, res) => { YtController.genClip(req, res) });
    this.app.get("/clip/:filename", (req, res) => { YtController.getClip(req, res) });
    this.app.get("/listen/:id", (req, res, next) => { YtController.listenCh(req, res) });
    this.app.get("/get/:id", (req, res, next) => { this.redisMiddleware.cacheCheck(req, res, next) }, (req, res, next) => { YtController.getId(req, res) });
    this.app.get("/listen/:id", (req, res, next) => { YtController.listen(req, res) });
    this.app.put("/:id/end", (req, res, next) => { YtController.endListener(req, res) });
    this.app.post("/analyze/:id", (req, res, next) => { YtController.analyze(req, res, this.redisService) });
  }


}

