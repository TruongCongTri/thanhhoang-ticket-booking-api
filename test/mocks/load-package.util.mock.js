"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// Mock CJS thay thế cho ESM loader (import.meta) của NestJS khi chạy kiểm thử với ts-jest (CommonJS).
// Phải export đủ API của @nestjs/common/utils/load-package.util.
const packageCache = new Map();

function requireOrLoad(packageName, loaderFn) {
  return loaderFn ? loaderFn() : require(packageName);
}

exports.loadPackage = async function (packageName, context, loaderFn) {
  if (packageCache.has(packageName)) return packageCache.get(packageName);
  const pkg = await requireOrLoad(packageName, loaderFn);
  packageCache.set(packageName, pkg);
  return pkg;
};

exports.loadPackageSync = function (packageName, context, loaderFn) {
  if (packageCache.has(packageName)) return packageCache.get(packageName);
  const pkg = requireOrLoad(packageName, loaderFn);
  packageCache.set(packageName, pkg);
  return pkg;
};

exports.loadPackageCached = function (packageName, context) {
  if (packageCache.has(packageName)) return packageCache.get(packageName);
  return exports.loadPackageSync(packageName, context);
};

exports.tryLoadPackage = async function (packageName, loaderFn) {
  try {
    return await exports.loadPackage(packageName, undefined, loaderFn);
  } catch {
    return null;
  }
};
