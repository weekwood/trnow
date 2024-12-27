const fs = require('fs-extra');
const yaml = require('yaml');
const defaultConfig = require('../config/default');

const loadConfig = async (configPath) => {
    if (await fs.pathExists(configPath)) {
        const content = await fs.readFile(configPath, 'utf8');
        return {
            ...defaultConfig,
            ...yaml.parse(content)
        };
    }
    return defaultConfig;
};

module.exports = { loadConfig }; 