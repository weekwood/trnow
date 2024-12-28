const { execute: scan } = require('../src/commands/scan');
const { execute: transform } = require('../src/commands/transform');
const fs = require('fs-extra');
const path = require('path');

describe('Vue 文件处理', () => {
    const testDir = path.join(__dirname, 'fixtures/vue');
    const localeDir = path.join(testDir, 'locales');

    beforeEach(async () => {
        // 创建测试文件
        await fs.ensureDir(testDir);
        await fs.ensureDir(localeDir);
        
        // 创建测试用的 Vue 文件
        await fs.writeFile(path.join(testDir, 'Test.vue'), `
            <template>
                <div>
                    <h1>用户管理</h1>
                    <el-button>新增用户</el-button>
                    <el-input placeholder="请输入用户名" />
                    <span v-text="'删除确认'" />
                    <div title="提示信息">{{ messageText }}</div>
                </div>
            </template>
            
            <script>
            export default {
                data() {
                    return {
                        messageText: '操作成功',
                        placeholder: '请输入关键词'
                    }
                }
            }
            </script>
        `);
    });

    afterEach(async () => {
        // 清理测试文件
        await fs.remove(testDir);
    });

    test('扫描 Vue 文件中的中文文本', async () => {
        const results = await scan({ src: testDir });
        
        expect(results).toContainEqual(expect.objectContaining({
            text: '用户管理',
            type: 'template'
        }));
        expect(results).toContainEqual(expect.objectContaining({
            text: '新增用户',
            type: 'template'
        }));
        expect(results).toContainEqual(expect.objectContaining({
            text: '请输入用户名',
            type: 'template'
        }));
        expect(results).toContainEqual(expect.objectContaining({
            text: '删除确认',
            type: 'template'
        }));
        expect(results).toContainEqual(expect.objectContaining({
            text: '提示信息',
            type: 'template'
        }));
        expect(results).toContainEqual(expect.objectContaining({
            text: '操作成功',
            type: 'script'
        }));
        expect(results).toContainEqual(expect.objectContaining({
            text: '请输入关键词',
            type: 'script'
        }));
    });

    (process.env.AI_API_KEY ? test : test.skip)('转换 Vue 文件中的中文文本', async () => {
        const flags = {
            src: testDir,
            localeDir,
            sourceLang: 'zh-CN',
            keyStyle: 'snake_case',
            config: '.trnow.yml'
        };

        // 创建测试配置文件
        await fs.writeJson(path.join(testDir, '.trnow.yml'), {
            keyGeneration: {
                style: 'snake_case',
                ai: {
                    enabled: false  // 测试时禁用 AI
                }
            }
        });

        await transform(flags);

        const content = await fs.readFile(path.join(testDir, 'Test.vue'), 'utf-8');
        
        // 检查模板转换
        expect(content).toContain('{{ $t(\'yonghu_guanli\') }}');
        expect(content).toContain('{{ $t(\'xinzeng_yonghu\') }}');
        expect(content).toContain(':placeholder="$t(\'qing_shuru_yonghuming\')');
        expect(content).toContain('v-text="$t(\'shanchu_queren\')');
        expect(content).toContain(':title="$t(\'tishixinxi\')');

        // 检查脚本转换
        expect(content).toContain('messageText: this.$t(\'caozuo_chenggong\')');
        expect(content).toContain('placeholder: this.$t(\'qing_shuru_guanjianci\')');

        // 检查生成的语言文件
        const messages = await fs.readJson(path.join(localeDir, 'zh-CN.json'));
        expect(messages).toMatchObject({
            yonghu_guanli: '用户管理',
            xinzeng_yonghu: '新增用户',
            qing_shuru_yonghuming: '请输入用户名',
            shanchu_queren: '删除确认',
            tishixinxi: '提示信息',
            caozuo_chenggong: '操作成功',
            qing_shuru_guanjianci: '请输入关键词'
        });
    });
}); 