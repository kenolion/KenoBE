import express from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import { listenYt } from "./yt-util.mjs";
import { initTokenizer } from "./utils/data-prc-util.mjs";
import { Innertube } from "youtubei.js";
import { cnvTimestampToMin } from "./utils/math-util.mjs";
import { ChatAnalyzer } from "./chat-analyzer.mjs";
import set from "lodash/set.js";
import { OUT_PATH, VID_STATS_NM } from "./app-const.mjs";

// variables
const prisma = new PrismaClient();
const app = express();
const port = 4000;
const ytChatObj = {};
const yt = await Innertube.create(/* options */);
//dlVideo(yt,'b6eqXTcxzf8');
//init jp dictionary tokenizer from kuromoji
await initTokenizer();

app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

// youtube chat API
app.get("/listen/:channelId/:id", (req, res) => {
  listenYt(req.params.id, req.params.channelId, res).then((mc) => {
    set(ytChatObj, req.params.id + ".mc", mc);
    mc.listen();
    return res;
  });
});

app.get("/get/:id", (req, res) => {
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
});

app.get("/listen/:id", (req, res) => {
  // res.setHeader("Content-Type", "application/json");
  listenYt(req.params.id, null, res).then((mc) => {
    set(ytChatObj, req.params.id + ".mc", mc);
    mc.listen();
    return res;
  });
});

app.put("/:id/end", (req, res) => {
  let id = req.params.id;
  const masterChat = ytChatObj[id].mc;
  masterChat?.stop();
  return res.json({
    success: true,
    message: `Ended listening to ${id} live chat.`,
  });
});

// Backend for website
app.get("/post", (req, res) => {
  res.setHeader("Content-Type", "application/json");

  findPost(req, res)
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
});

app.post("/add", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  addPost(req, res);
});

async function addPost(req, res) {
  // Connect the client
  await prisma.$connect();
  // ... you will write your Prisma Client queries here
  const post = await prisma.post.create({
    data: req.body,
  });

  // title: 'Prisma makes databases easy',
  // published: true,
  // createdAt: new Date(),
  // updatedAt: new Date(),
  // authorEmail: 'test@gmail.com',
  // content: 'This is the content of the post',
  // add more fields and values as needed
  console.log(post);
  res.json(post);
}

async function findPost(req, res) {
  // Connect the client
  await prisma.$connect();
  // ... you will write your Prisma Client queries here
  // {
  //   where: {
  //     email: "test@gmail.com",
  //   },
  //   select: {
  //     email: true,
  //     name: true,
  //     createdAt: true,
  //   },
  // }

  // const user = await prisma.user.findUnique({
  //   where: {
  //     email: "test@gmail.com",
  //   },
  //   select: {
  //     email: true,
  //     name: true,
  //     createdAt: true,
  //   },
  // });

  const postLis = await prisma.post.findMany({
    select: {
      authorEmail: true,
      content: true,
      createdAt: true,
      title: true,
      id: true,
    },
  });

  res.json(postLis);
}

app.get("/users/:userId/books/:bookId", (req, res) => {
  res.send(req.params);
});
