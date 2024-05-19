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
    this.app.get("/listen/:id", (req, res, next) => { YtController.listenCh(req, res) });
    this.app.get("/get/:id", (req, res, next) => { this.redisMiddleware.cacheCheck(req, res, next) }, (req, res, next) => { YtController.getId(req, res) });
    this.app.get("/listen/:id", (req, res, next) => { YtController.listen(req, res) });
    this.app.put("/:id/end", (req, res, next) => { YtController.endListener(req, res) });
    this.app.post("/analyze/:id", (req, res, next) => { YtController.analyze(req, res, this.redisService) });
  }


}

