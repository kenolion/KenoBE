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
  let fmtHour = Math.floor(min / 60);
  let fmtMin = min % 60;
  let fmtSec = (fmtMin - Math.floor(fmtMin)) * 60;
  return `${fmtHour}:${Math.floor(fmtMin)}:${Math.floor(fmtSec)}`;
}

// format's given minute to hh:mm:ss
export function fmtMin(min) {
  let fmtHour = Math.floor(min / 60);
  let fmtMin = min % 60;
  let fmtSec = (fmtMin - Math.floor(fmtMin)) * 60;
  return `${fmtHour}:${fmtMin}:${fmtSec}`;
}

// converts microsecond timestamp to millisecond timestamp
export function normTimestamp(tTimestamp) {
  return tTimestamp / 1000;
}
