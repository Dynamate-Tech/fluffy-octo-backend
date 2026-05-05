import fs from "fs";

const FILE = "./token.json";

export function saveToken(token) {
  fs.writeFileSync(FILE, JSON.stringify({ token }));
}

export function getToken() {
  if (!fs.existsSync(FILE)) return null;
  return JSON.parse(fs.readFileSync(FILE)).token;
}
