import fs from "fs";
import { Masterchat } from "masterchat";
import { extractWordHeatMap } from "./data-prc-util.mjs";
// async funtion that intializes masterchat and listens to youtube chat
async function listenYt(videoId, channelId, res) {
  // let mc = await Masterchat.init(videoId);
  let mc = channelId
    ? new Masterchat(videoId, channelId, { mode: "replay" })
    : await Masterchat.init(videoId);
  let chatLis = [];
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

        pvsTimeStamp = chatTimestamp - (chatTimestamp % 60000000);
        timeStampLis = [];
      }
      let message = { timeStamp: pvsTimeStamp, message: exrMsg(chat.message) };
      timeStampLis.push(message);
      chatLis.push(message);
    });

    // Handle errors
    mc.on("error", (err) => {
      console.log(err.code);
      console.log(err.stack);
    });

    // Handle end event
    mc.on("end", () => {
      exrData(chatLis, wordHeatMap, videoId).then(() => {
        console.log("Data extracted");
      });
      console.log("Live stream has ended");
    });
    console.log("listening to " + videoId + " live chat.");
    res.json({ success: true, message: "Started listening to live chat." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }

  return mc;
}

async function exrData(chatLis, wordHeatMap, videoId) {
  let row = "";
  for (let i in chatLis) {
    let data = chatLis[i];
    row += data.timeStamp + "," + data.message + "\r\n";
  }
  const t1 = performance.now();

  fs.writeFile(
    `./output/${videoId}.csv`,
    row,
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
    const mapAsObject = Object.fromEntries(wordHeatMap.entries());
    const jsonString = JSON.stringify(mapAsObject);
    fs.writeFile(
      `./output/${videoId}.json`,
      jsonString,
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

export { listenYt };
