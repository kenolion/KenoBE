import {  writeFile } from "fs";
import { exec } from "child_process";
import { Masterchat } from "masterchat";
import { extractWordHeatMap } from "./utils/data-prc-util.mjs";
import { VID_STATS_NM,VID_MSG_NM } from "./app-const.mjs";

// async funtion that intializes masterchat and listens to youtube chat
async function listenYt(videoId, channelId, res) {
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
      if(!chatLis[pvsTimeStamp]){
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
  // let row = "";
  // for (let i in chatLis) {
  //   let data = chatLis[i];
  //   row += data.timeStamp + "," + data.message + "\r\n";
  // }
  
  // row = ;
  const t1 = performance.now();

  writeFile(
    `./output/${videoId}${VID_MSG_NM}.json`,
    JSON.stringify(chatLis),
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
    writeFile(
      `./output/${videoId}${VID_STATS_NM}.json`,
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

async function cutVideo(from, to, id) {

  // Check if the parameters are valid
  if (!from || !to || !id) {
    throw new Error("Invalid parameters");
  }

  // Check if the ffmpeg executable exists
  if (!await fs.existsSync("/usr/bin/ffmpeg")) {
    throw new Error("ffmpeg executable not found");
  }

  // Replace colons in 'from' and 'to' timestamps with an empty string
  const from_fixed = from.replace(':', '');
  const to_fixed = to.replace(':', '');

  // Execute the ffmpeg command with the adjusted parameters
  exec(
    `ffmpeg -ss ${from} -to ${to} -i ./output/vid/${id}.mp4 -c copy ./output/vid/${from_fixed}-${to_fixed}-${id}.mp4`,
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

export { listenYt, cutVideo };
