function eclaircir(hex, ratio) {
  const r = parseInt(hex.slice(1, 3), 16);
  const v = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const melange = c => Math.round(c + (255 - c) * ratio);
  return '#' + [melange(r), melange(v), melange(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
console.log('#ef4444 +35% ->', eclaircir('#ef4444', 0.35));
console.log('#f59e0b +35% ->', eclaircir('#f59e0b', 0.35));
console.log('#566C9D +35% ->', eclaircir('#566C9D', 0.35));
