import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import {
  parseVersionArguments,
  updateVersion
} from '@mnaoumov/typescript-dev-toolkit/version';
import process from 'node:process';

const [, , ...$arguments] = process.argv;
const { options, versionUpdateType } = parseVersionArguments($arguments);
await wrapCliTask(() => updateVersion(versionUpdateType, options));
