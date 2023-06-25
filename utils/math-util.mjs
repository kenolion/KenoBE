// Calculates the minute of a stream from the start timestamp and target timestamp
// Formula = (target timestamp / 1000 - start timestamp) / 60000
// (microsecond divide by 1000 to millisecond)
//  * @param {number} sTimeStamp - start timestamp
//  * @param {number} tTimestamp - target timestamp
export function cnvTimestampToMin(sTimeStamp, tTimestamp) {
  return (normTimestamp(tTimestamp) - sTimeStamp) / 60000;
}

// converts microsecond timestamp to millisecond timestamp
export function normTimestamp(tTimestamp) {
  return tTimestamp / 1000;
}
