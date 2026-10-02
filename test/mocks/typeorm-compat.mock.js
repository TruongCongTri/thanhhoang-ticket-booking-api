"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// Bản CJS của @nestjs/typeorm/dist/common/typeorm-compat.js (bản gốc dùng import.meta, không chạy được dưới ts-jest CommonJS)
function resolveTypeormExport(exportName) {
  try {
    return require("typeorm")[exportName];
  } catch {
    return undefined;
  }
}

exports.Connection = resolveTypeormExport("Connection");
exports.AbstractRepository = resolveTypeormExport("AbstractRepository");
