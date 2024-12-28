module.exports = {
    // 可配置的正则表达式
    patterns: {
        template: [
            // 自定义模板扫描规则
        ],
        script: [
            // 自定义脚本扫描规则
        ],
        jsx: {
            // JSX 特有的属性
            attributes: [
                'aria-label',
                'placeholder',
                'alt',
                'title',
                'data-tooltip'
            ],
            // JSX 特有的组件属性
            componentProps: [
                'label',
                'message',
                'description',
                'tooltip'
            ],
            // 需要处理的文件类型
            extensions: [
                '.jsx',
                '.tsx',
                '.js',
                '.ts'
            ]
        }
    },
    
    // 忽略的文件或目录
    ignore: [
        'node_modules',
        'dist',
        '**/*.test.{js,jsx,ts,tsx}'
    ],

    // key 生成规则
    keyGeneration: {
        style: 'camelCase',
        maxLength: 32,
        prefix: '',
        ai: {
            enabled: false,
            provider: 'deepseek',
            model: 'deepseek-chat',
            baseURL: 'https://api.deepseek.com/v1',
            apiKey: ''
        }
    },
    
    // 基本配置
    sourceDir: './src',
    localeDir: './src/locales',
    sourceLang: 'zh-CN',
    
    // 备份设置
    backup: {
        dir: './.trnow-backup',
        keep: 5
    }
}; 