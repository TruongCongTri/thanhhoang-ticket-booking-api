import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

// Path aliases từ tsconfig.json
const { config: tsconfig } = ts.readConfigFile(
  './tsconfig.json',
  ts.sys.readFile,
);
const paths = tsconfig?.compilerOptions?.paths ?? {};

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  transformIgnorePatterns: ['node_modules[\\\\/](?!(@nestjs)[\\\\/])'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
    // Chặn triệt để lỗi ESM của load-package.util trên cả Windows và Linux
    '^.*[\\\\/]load-package\\.util(\\.js)?$':
      '<rootDir>/test/mocks/load-package.util.mock.js',
    // @nestjs/typeorm dùng import.meta (ESM) không chạy được dưới CommonJS
    '^.*[\\\\/]typeorm-compat(\\.js)?$':
      '<rootDir>/test/mocks/typeorm-compat.mock.js',
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    'libs/**/*.(t|j)s',
    'apps/**/*.(t|j)s',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
