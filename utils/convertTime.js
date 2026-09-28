function convertTime(duration) {
  const seconds = parseInt((duration / 1000) % 60);
  const minutes = parseInt((duration / (1000 * 60)) % 60);
  const hours   = parseInt((duration / (1000 * 60 * 60)) % 24);

  const fmtH = String(hours).padStart(2, "0");
  const fmtM = String(minutes).padStart(2, "0");
  const fmtS = String(seconds).padStart(2, "0");

  if (duration < 3600000) return `${fmtM}:${fmtS}`;
  return `${fmtH}:${fmtM}:${fmtS}`;
}

module.exports = { convertTime };
