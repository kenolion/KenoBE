import { Router } from "express";
import {
  listenCh,
  getId,
  listen,
  endListener,
  analyze,
} from "../controller/yt-controller.mjs";

const router = Router();

router.get("/listen/:channelId/:id", listenCh);
router.get("/get/:id", getId);
router.get("/listen/:id", listen);
router.put("/:id/end", endListener);
router.post("/analyze/:id", analyze);
export { router };
