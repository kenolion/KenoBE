import express from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import { listenYt } from "./yt-util.mjs";
import { initTokenizer } from "./data-prc-util.mjs";
import { Innertube } from "youtubei.js";

// variables
const prisma = new PrismaClient();
const app = express();
const port = 4000;
const ytChatObj = {};
const yt = await Innertube.create(/* options */);
//dlVideo(yt,'b6eqXTcxzf8');
//init jp dictionary tokenizer from kuromoji
initTokenizer();

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
  // res.setHeader("Content-Type", "application/json");
  listenYt(req.params.id, req.params.channelId, res).then((mc) => {
    ytChatObj[req.params.channelId] = mc;
    mc.listen();
    return res;
  });
});

app.get("/get/:id", (req, res) => {
  // res.setHeader("Content-Type", "application/json");
  const info = yt.getBasicInfo(req.params.id).then((info) => {
    let time = info.basic_info.start_timestamp;
    let tim = new Date(time).valueOf();
    console.log(tim);
    console.log((req.query.t / 1000 - tim) / 60000);

    res.json(info);
    return res;
  });
});

app.get("/listen/:id", (req, res) => {
  // res.setHeader("Content-Type", "application/json");
  listenYt(req.params.id, null, res).then((mc) => {
    ytChatObj[req.params.channelId] = mc;
    mc.listen();
    return res;
  });
});

app.put("/:id/end", (req, res) => {
  let id = req.params.id;
  const masterChat = ytChatObj[id];
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
