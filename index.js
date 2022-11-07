const fs = require('fs');
const path = require('path');
const isWsl = require('is-wsl');
const pathType = require('path-type');
const filterObj = require('filter-obj');
const camelcase = require('camelcase');
const camelcaseKeys = require('camelcase-keys');
const loadEnvFile = require('envy/lib/load-env-file');
const envy = require('envy');

const num = fs.constants;
const permissionMask = 0o777;
const ownerReadWrite = num.S_IRUSR | num.S_IWUSR;

const checkMode = (filepath, mask) => {
    const status = fs.statSync(filepath);
    if (!status.isFile()) {
        throw new Error(`Filepath must be a file: ${filepath}`);
    }
    return status.mode & mask;
};

const assertHidden = (filepath) => {
    const filename = path.basename(filepath);
    if (!filename.startsWith('.')) {
        throw new Error(`Filepath must be hidden. Fix: mv '${filename}' '.${filename}'`);
    }
};

const assertIgnored = (filepath) => {
    const failMessage = `File must be ignored by git. Fix: echo '${path.basename(filepath)}' >> .gitignore`;
    let ignores;
    try {
        ignores = fs.readFileSync(path.join(filepath, '..', '.gitignore'), 'utf8');
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            if (!pathType.dirSync(path.join(filepath, '..', '.git'))) {
                return;
            }
            throw new Error(failMessage);
        }
        throw error;
    }

    if (!ignores.split(/\r?\n/u).includes(path.basename(filepath))) {
        throw new Error(failMessage);
    }
};

const isWindows = () => {
    return isWsl || process.platform === 'win32';
};

// eslint-disable-next-line max-statements
const lwenv = (input) => {
    const envPath = input || '.env';
    const examplePath = envPath + '.example';

    assertHidden(envPath);

    const FILEWRITEABLE = isWindows() ? num.S_IWUSR : num.S_IWOTH;

    if (checkMode(examplePath, FILEWRITEABLE) === FILEWRITEABLE) {
        throw new Error(`File must not be writable by others. Fix: chmod o-w '${examplePath}'`);
    }

    const exampleEnv = loadEnvFile(examplePath);
    const exampleEnvKeys = Object.keys(exampleEnv);
    const camelizedExampleEnvKeys = Object.keys(camelcaseKeys(exampleEnv));

    if (exampleEnvKeys.length === 0) {
        throw new Error(`At least one entry is required in ${examplePath}`);
    }
    const exampleHasValues = Object.values(exampleEnv).some((val) => {
        return val !== '';
    });
    if (exampleHasValues) {
        throw new Error(`No values are allowed in ${examplePath}, put them in ${envPath} instead`);
    }

    const camelizedGlobalEnv = camelcaseKeys(process.env);
    const camelizedGlobalEnvKeys = Object.keys(camelizedGlobalEnv);

    // We treat env vars as case insensitive, like Windows does.
    const needsEnvFile = camelizedExampleEnvKeys.some((key) => {
        return !camelizedGlobalEnvKeys.includes(key);
    });

    if (!needsEnvFile) {
        return filterObj(camelizedGlobalEnv, camelizedExampleEnvKeys);
    }

    if (isWindows() && (checkMode(envPath, num.S_IRUSR) !== num.S_IRUSR || checkMode(envPath, num.S_IWUSR) == num.S_IWUSR)) {
        throw new Error(`File permissions are unsafe. Make them readonly and Administrator as owner '${envPath}'`);
    }
    else if (!isWindows() && checkMode(envPath, permissionMask) !== ownerReadWrite) {
        throw new Error(`File permissions are unsafe. Fix: chmod 600 '${envPath}'`);
    }

    assertIgnored(envPath);

    const camelizedLocalEnv = camelcaseKeys(loadEnvFile(envPath));

    const camelizedMergedEnv = {
        ...camelizedLocalEnv,
        ...camelizedGlobalEnv
    };
    const camelizedMergedEnvKeys = Object.keys(camelizedMergedEnv);

    const camelizedMissingKeys = camelizedExampleEnvKeys.filter((key) => {
        return !camelizedMergedEnv[key] || !camelizedMergedEnvKeys.includes(key);
    });
    if (camelizedMissingKeys.length > 0) {
        const missingKeys = camelizedMissingKeys.map((camelizedMissingKey) => {
            return exampleEnvKeys.find((exampleKey) => {
                return camelcase(exampleKey) === camelizedMissingKey;
            });
        });
        throw new Error(`Environment variables are missing: ${missingKeys.join(', ')}`);
    }

    const keepKeys = [...new Set([...Object.keys(camelizedLocalEnv), ...camelizedExampleEnvKeys])];
    return filterObj(camelizedMergedEnv, keepKeys);
};

module.exports = exports = lwenv