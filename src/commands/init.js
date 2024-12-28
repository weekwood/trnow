const fs = require('fs-extra');
const path = require('path');
const yaml = require('yaml');
const prompts = require('prompts');
const defaultConfig = require('../config/default');

// 更新 .gitignore
const updateGitignore = async () => {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const backupEntry = '.trnow-backup';
    
    try {
        let content = '';
        if (await fs.pathExists(gitignorePath)) {
            content = await fs.readFile(gitignorePath, 'utf-8');
            // 检查是否已经包含
            if (content.includes(backupEntry)) {
                return;
            }
            // 确保在新行添加
            if (!content.endsWith('\n')) {
                content += '\n';
            }
        }
        
        // 添加备份目录到 .gitignore
        content += `${backupEntry}\n`;
        await fs.writeFile(gitignorePath, content, 'utf-8');
    } catch (error) {
        console.error('更新 .gitignore 失败:', error);
    }
};

// 添加取消处理
const onCancel = () => {
    console.log('操作已取消');
    process.exit(0);
};

const generateConfig = (flags) => {
    const config = {
        patterns: defaultConfig.patterns,
        ignore: defaultConfig.ignore,
        sourceDir: flags.sourceDir || './src',
        localeDir: flags.localeDir || './src/locales',
        sourceLang: 'zh-CN',
        keyGeneration: {
            style: flags.keyStyle || 'camelCase',
            ai: {
                enabled: false,
                provider: 'deepseek',
                model: 'deepseek-chat',
                baseURL: 'https://api.deepseek.com/v1',
                apiKey: flags.ai?.apiKey || ''
            }
        },
        backup: defaultConfig.backup
    };

    // 如果启用了 AI，覆盖默认配置
    if (flags.ai?.enabled) {
        config.keyGeneration.ai = {
            ...config.keyGeneration.ai,
            enabled: true,
            apiKey: flags.ai.apiKey
        };
    }

    return config;
};

const execute = async (flags) => {
    try {
        const config = generateConfig(flags);
        
        // 写入配置文件
        await fs.writeFile(
            path.join(process.cwd(), '.trnow.yml'),
            yaml.stringify(config),
            'utf8'
        );

        return {
            type: 'success',
            text: `配置文件已生成：${path.join(process.cwd(), '.trnow.yml')}`
        };
    } catch (error) {
        return {
            type: 'error',
            text: `生成配置文件失败：${error.message}`
        };
    }
};

const loadConfig = async (configPath = '.trnow.yml') => {
    const defaultConfig = require('../config/default');
    try {
        if (await fs.pathExists(configPath)) {
            const content = await fs.readFile(configPath, 'utf-8');
            return {
                ...defaultConfig,
                ...yaml.parse(content)
            };
        }
    } catch (error) {
        console.error('读取配置文件失败:', error);
    }
    return defaultConfig;
};

module.exports = {
    execute,
    loadConfig
}; 