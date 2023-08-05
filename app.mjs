import express from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import { router } from "./src/router/yt-router.mjs";
import { initTokenizer } from "./src/utils/data-prc-util.mjs";

// variables
const prisma = new PrismaClient();
const app = express();
const port = 4000;
const ytChatObj = {};

//dlVid("b6eqXTcxzf8");
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

app.route(router);

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
