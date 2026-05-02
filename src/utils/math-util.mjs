// Calculates the minute of a stream from the start timestamp and target timestamp
// Formula = (target timestamp / 1000 - start timestamp) / 60000
// (microsecond divide by 1000 to millisecond)
//  * @param {number} sTimeStamp - start timestamp
//  * @param {number} tTimestamp - target timestamp
export function cnvTimestampToMin(sTimeStamp, tTimestamp) {
  return (normTimestamp(tTimestamp) - sTimeStamp) / 60000;
}

// format timestamp
export function fmtTimestamp(sTimeStamp, tTimestamp) {
  let min = cnvTimestampToMin(sTimeStamp, tTimestamp);
  return fmtMin(min);
}

// format's given minute to hh:mm:ss
export function fmtMin(min) {
  const totalSeconds = Math.floor((Number(min) * 60) + 1e-9);
  const fmtHour = Math.floor(totalSeconds / 3600);
  const fmtMin = Math.floor((totalSeconds % 3600) / 60);
  const fmtSec = totalSeconds % 60;
  return `${padTime(fmtHour)}:${padTime(fmtMin)}:${padTime(fmtSec)}`;
}

// converts microsecond timestamp to millisecond timestamp
export function normTimestamp(tTimestamp) {
  return tTimestamp / 1000;
}

function padTime(value) {
  return String(value).padStart(2, "0");
}
