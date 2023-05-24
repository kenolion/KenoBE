import fs from "fs";

function loadFile(fileNm) {
  return new Promise((resolve, reject) => {
    fs.readFile(`./output/${fileNm}`, "utf8", (err, data) => {
      if (err) {
        console.error("Error reading file:", err);
        reject(err);
      }

      try {
        const jsonData = JSON.parse(data);
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    });
  });
}
