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

const execute = async (flags = {}) => {
    const configPath = flags.config || '.trnow.yml';
    const config = {
        ...defaultConfig,
        source: {
            ...defaultConfig.source,
            dir: flags.sourceDir || './src'
        },
        locales: {
            ...defaultConfig.locales,
            dir: flags.localeDir || './src/locales',
            source: flags.sourceLang || 'zh-CN',
            target: flags.targetLangs || ['en-US']
        },
        keyGeneration: {
            ...defaultConfig.keyGeneration,
            style: flags.keyStyle || defaultConfig.keyGeneration.style
        }
    };

    // 打印调试信息
    console.log('Saving config:', {
        keyStyle: flags.keyStyle,
        configKeyStyle: config.keyGeneration.style
    });

    // 保存配置文件
    await fs.outputFile(
        configPath,
        yaml.stringify(config),
        'utf8'
    );

    // 创建必要的目录
    await fs.ensureDir(config.locales.dir);
    await fs.ensureDir(defaultConfig.backup.dir);

    // 更新 .gitignore
    await updateGitignore();

    return {
        type: 'success',
        text: `配置文件已创建: ${configPath}，并更新了 .gitignore\n\n接下来你可以运行 'trnow scan' 预览需要国际化的文本，或者直接运行 'trnow transform' 开始转换。`
    };
};

module.exports = { execute }; 