import { writeFile, existsSync } from "fs";
import { exec } from "child_process";
import { Masterchat } from "@kenolion/masterchat";
import { extractWordHeatMap } from "../utils/data-prc-util.mjs";
import { VID_STATS_NM, VID_MSG_NM } from "../constants/app-const.mjs";
import { Innertube } from "youtubei.js";
import { OUT_PATH } from "../constants/app-const.mjs";

const yt = await Innertube.create(/* options */);
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
  if (!(await fs.existsSync("/usr/bin/ffmpeg"))) {
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

export { listenYt, cutVideo, yt, dlVid };
