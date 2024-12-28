const OpenAI = require('openai');

class AIKeyGenerator {
    constructor(config) {
        this.config = config;

        this.batchSize = 20;
        this.prompt = `为中文文本生成合适的国际化 key，要求：
            1. 使用点号分隔的命名空间，如：
               - common.form.username
               - common.table.noData
               - user.list.title
               - user.form.submit
            4. 使用 {style} 命名风格
            5. 保持命名的一致性和语义化
            7. 请严格按照以下格式返回每一行：
              Text: "{text}" => Key: \`namespace.key_here\`

            文本列表：
            {text}`;
    }

    async generateKeys(texts, style) {
        if (!this.config?.enabled || !this.config?.apiKey || !this.config?.baseURL || !this.config?.model) {
            console.log('AI config check failed:', {
                enabled: this.config?.enabled,
                hasApiKey: !!this.config?.apiKey,
                hasBaseURL: !!this.config?.baseURL,
                hasModel: !!this.config?.model
            });
            return null;
        }

        try {
            // 延迟创建 OpenAI 户端
            if (!this.client) {
                this.client = new OpenAI({
                    apiKey: this.config.apiKey,
                    baseURL: this.config.baseURL
                });
            }

            console.log('Sending AI request:', {
                texts,
                style,
                model: this.config.model
            });

            // 使用配置文件中的 prompt
            const prompt = this.prompt
                .replace('{style}', style)
                .replace('{text}', texts.join('\n'));

            const response = await this.client.chat.completions.create({
                model: this.config.model,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                temperature: 0.3,
                max_tokens: 1000,
                n: 1
            });

            console.log('AI response:', response.choices[0].message.content);

            // 解析返回的结果
            const content = response.choices[0].message.content;
            const keyMap = new Map();
            
            // 按行处理每个文本
            const lines = content.split('\n').filter(Boolean);
            texts.forEach((text) => {
                const line = lines.find(l => 
                    l.includes(`Text: "${text}"`) || 
                    l.includes(`Text: '${text}'`) ||
                    // 移除序号后的文本匹配
                    l.replace(/^\d+\.\s*/, '').includes(`Text: "${text}"`) ||
                    l.replace(/^\d+\.\s*/, '').includes(`Text: '${text}'`)
                );
                if (line) {
                    const keyMatch = line.match(/Key:\s*[`']([^`']+)[`']/i);
                    if (keyMatch) {
                        keyMap.set(text, this.normalizeKey(keyMatch[1], style));
                    }
                }
            });

            return keyMap;
        } catch (error) {
            console.error('AI key generation failed:', error);
            return null;
        }
    }

    async generateKey(text, style) {
        const keyMap = await this.generateKeys([text], style);
        return keyMap?.get(text) || null;
    }

    normalizeKey(key, style) {
        // 保留点号作为命名空间分隔符
        key = key.replace(/['"]/g, '').replace(/[^\w\s.]/g, '_');
        
        // 如果 key 中已经包含点号，说明是命名空间格式，保持原样
        if (key.includes('.')) {
            if (style === 'camelCase') {
                // 只对每个部分的首字母做大小写处理
                return key.split('.')
                    .map(part => part
                        .split(/[\s_-]+/)
                        .map((word, index) => 
                            index === 0 ? word.toLowerCase() : 
                            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                        )
                        .join(''))
                    .join('.');
            }
            // snake_case 时保持原有的点号分隔
            return key.split('.')
                .map(part => part.toLowerCase().replace(/[\s-]+/g, '_'))
                .join('.');
        }

        // 如果没有点号，按照原来的方式处理
        const words = key.split(/[\s_-]+/);
        if (style === 'camelCase') {
            return words
                .map((word, index) => 
                    index === 0 ? word.toLowerCase() : 
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                )
                .join('');
        }
        return words.join('_').toLowerCase();
    }
}

module.exports = AIKeyGenerator; 